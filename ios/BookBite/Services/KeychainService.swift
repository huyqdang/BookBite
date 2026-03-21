import Foundation
import Security

class KeychainService {
    static let shared = KeychainService()
    private let service = "app.bookbite"

    private init() {}

    // MARK: - Token Management

    func saveTokens(accessToken: String, refreshToken: String) {
        save(key: "accessToken", value: accessToken)
        save(key: "refreshToken", value: refreshToken)
    }

    func getAccessToken() -> String? {
        return get(key: "accessToken")
    }

    func getRefreshToken() -> String? {
        return get(key: "refreshToken")
    }

    func clearTokens() {
        delete(key: "accessToken")
        delete(key: "refreshToken")
    }

    // MARK: - Generic Keychain Operations

    private func save(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]

        // Delete existing
        SecItemDelete(query as CFDictionary)

        // Add new
        var newQuery = query
        newQuery[kSecValueData as String] = data
        SecItemAdd(newQuery as CFDictionary, nil)
    }

    private func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
