import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(Int, String)
    case networkError(Error)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .noData: return "No data received"
        case .decodingError(let error): return "Decoding error: \(error.localizedDescription)"
        case .serverError(let code, let message): return "Server error (\(code)): \(message)"
        case .networkError(let error): return error.localizedDescription
        case .unauthorized: return "Session expired. Please log in again."
        }
    }
}

actor APIService {
    static let shared = APIService()

    // Change this to your server URL
    private let baseURL = "http://localhost:3001/api"

    private var accessToken: String? {
        get { KeychainService.shared.getAccessToken() }
    }

    private var refreshToken: String? {
        get { KeychainService.shared.getRefreshToken() }
    }

    // MARK: - Generic Request

    func request<T: Decodable>(
        method: String = "GET",
        path: String,
        body: Encodable? = nil,
        authenticated: Bool = true
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if authenticated, let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            let encoder = JSONEncoder()
            request.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }

        if httpResponse.statusCode == 401 {
            // Try token refresh
            if authenticated, let _ = refreshToken {
                let refreshed = try await attemptTokenRefresh()
                if refreshed {
                    // Retry the request with new token
                    var retryRequest = request
                    if let newToken = self.accessToken {
                        retryRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
                    }
                    let (retryData, retryResponse) = try await URLSession.shared.data(for: retryRequest)
                    guard let retryHttp = retryResponse as? HTTPURLResponse else {
                        throw APIError.noData
                    }
                    if retryHttp.statusCode >= 400 {
                        throw APIError.unauthorized
                    }
                    return try decodeResponse(retryData)
                }
            }
            throw APIError.unauthorized
        }

        if httpResponse.statusCode >= 400 {
            let errorBody = try? JSONDecoder().decode([String: String].self, from: data)
            throw APIError.serverError(
                httpResponse.statusCode,
                errorBody?["error"] ?? "Unknown error"
            )
        }

        return try decodeResponse(data)
    }

    private func decodeResponse<T: Decodable>(_ data: Data) throws -> T {
        let decoder = JSONDecoder()
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    private func attemptTokenRefresh() async throws -> Bool {
        guard let refresh = refreshToken else { return false }

        struct RefreshBody: Encodable {
            let refreshToken: String
        }

        do {
            let tokens: TokenResponse = try await request(
                method: "POST",
                path: "/auth/refresh",
                body: RefreshBody(refreshToken: refresh),
                authenticated: false
            )
            KeychainService.shared.saveTokens(
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            )
            return true
        } catch {
            return false
        }
    }

    // MARK: - Auth

    func register(email: String, password: String, displayName: String) async throws -> AuthResponse {
        struct Body: Encodable {
            let email: String
            let password: String
            let displayName: String
        }
        return try await request(
            method: "POST",
            path: "/auth/register",
            body: Body(email: email, password: password, displayName: displayName),
            authenticated: false
        )
    }

    func login(email: String, password: String) async throws -> AuthResponse {
        struct Body: Encodable {
            let email: String
            let password: String
        }
        return try await request(
            method: "POST",
            path: "/auth/login",
            body: Body(email: email, password: password),
            authenticated: false
        )
    }

    func appleAuth(identityToken: String, email: String?, fullName: String?) async throws -> AuthResponse {
        struct Body: Encodable {
            let identityToken: String
            let email: String?
            let fullName: String?
        }
        return try await request(
            method: "POST",
            path: "/auth/apple",
            body: Body(identityToken: identityToken, email: email, fullName: fullName),
            authenticated: false
        )
    }

    func googleAuth(idToken: String, email: String?, displayName: String?, avatarUrl: String?) async throws -> AuthResponse {
        struct Body: Encodable {
            let idToken: String
            let email: String?
            let displayName: String?
            let avatarUrl: String?
        }
        return try await request(
            method: "POST",
            path: "/auth/google",
            body: Body(idToken: idToken, email: email, displayName: displayName, avatarUrl: avatarUrl),
            authenticated: false
        )
    }

    // MARK: - Feed

    func getFeed(cursor: String? = nil, limit: Int = 10, readingTime: Int? = nil, category: String? = nil) async throws -> FeedResponse {
        var params: [String] = []
        if let cursor = cursor { params.append("cursor=\(cursor)") }
        params.append("limit=\(limit)")
        if let rt = readingTime { params.append("readingTime=\(rt)") }
        if let cat = category { params.append("category=\(cat)") }
        // Send the user's timezone so the backend knows their local "today"
        let tz = TimeZone.current.identifier
        params.append("timezone=\(tz)")
        let query = "?\(params.joined(separator: "&"))"
        return try await request(path: "/feed\(query)")
    }

    // MARK: - Stories

    func getStory(id: String) async throws -> Story {
        return try await request(path: "/stories/\(id)")
    }

    func toggleLike(storyId: String) async throws -> LikeResult {
        return try await request(method: "POST", path: "/stories/\(storyId)/like")
    }

    func toggleBookmark(storyId: String) async throws -> BookmarkResult {
        return try await request(method: "POST", path: "/stories/\(storyId)/bookmark")
    }

    func trackView(storyId: String, readPercentage: Double) async throws {
        struct Body: Encodable {
            let readPercentage: Double
        }
        let _: [String: Bool] = try await request(
            method: "POST",
            path: "/stories/\(storyId)/view",
            body: Body(readPercentage: readPercentage)
        )
    }

    /// Batch-mark stories as "seen" so they never appear in the feed again.
    func markSeen(storyIds: [String]) async throws {
        struct Body: Encodable {
            let storyIds: [String]
        }
        struct Response: Decodable {
            let marked: Int
        }
        let _: Response = try await request(
            method: "POST",
            path: "/feed/seen",
            body: Body(storyIds: storyIds)
        )
    }

    // MARK: - Bookmarks

    func getBookmarks(cursor: String? = nil, limit: Int = 10) async throws -> FeedResponse {
        var params: [String] = []
        if let cursor = cursor { params.append("cursor=\(cursor)") }
        params.append("limit=\(limit)")
        let query = "?\(params.joined(separator: "&"))"
        return try await request(path: "/bookmarks\(query)")
    }

    // MARK: - User

    func getProfile() async throws -> ProfileResponse {
        return try await request(path: "/profile")
    }

    func updateProfile(displayName: String?, avatarUrl: String?) async throws -> UserProfile {
        struct Body: Encodable {
            let displayName: String?
            let avatarUrl: String?
        }
        return try await request(
            method: "PUT",
            path: "/profile",
            body: Body(displayName: displayName, avatarUrl: avatarUrl)
        )
    }

    func getPreferences() async throws -> UserPreferences {
        return try await request(path: "/preferences")
    }

    func updatePreferences(
        bookCategories: [String]?,
        preferredReadingTimes: [Int]?,
        fontFamily: String? = nil,
        fontSize: Int? = nil,
        onboardingCompleted: Bool?
    ) async throws -> UserPreferences {
        struct Body: Encodable {
            let bookCategories: [String]?
            let preferredReadingTimes: [Int]?
            let timezone: String
            let fontFamily: String?
            let fontSize: Int?
            let onboardingCompleted: Bool?
        }
        return try await request(
            method: "PUT",
            path: "/preferences",
            body: Body(
                bookCategories: bookCategories,
                preferredReadingTimes: preferredReadingTimes,
                timezone: TimeZone.current.identifier,
                fontFamily: fontFamily,
                fontSize: fontSize,
                onboardingCompleted: onboardingCompleted
            )
        )
    }
}
