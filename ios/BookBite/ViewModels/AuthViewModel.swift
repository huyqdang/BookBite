import SwiftUI
import AuthenticationServices

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var onboardingCompleted = false
    @Published var isLoading = true
    @Published var showLogin = false  // Toggle between funnel and login screen
    @Published var error: String?
    @Published var currentUser: UserProfile?

    init() {
        checkExistingSession()
    }

    // MARK: - Session Check

    private func checkExistingSession() {
        if KeychainService.shared.getAccessToken() != nil {
            Task {
                do {
                    let profile: ProfileResponse = try await APIService.shared.getProfile()
                    self.currentUser = UserProfile(
                        id: profile.id,
                        email: profile.email,
                        displayName: profile.displayName,
                        avatarUrl: profile.avatarUrl,
                        role: profile.role,
                        onboardingCompleted: profile.preferences?.onboardingCompleted
                    )
                    self.onboardingCompleted = profile.preferences?.onboardingCompleted ?? false
                    self.isAuthenticated = true
                    // Store userId so feed cache is validated per-user
                    FeedViewModel.setCurrentUserId(profile.id)
                } catch {
                    KeychainService.shared.clearTokens()
                }
                self.isLoading = false
            }
        } else {
            self.isLoading = false
        }
    }

    // MARK: - Funnel Completion

    /// Called when the onboarding funnel finishes (register + save preferences in one shot).
    func handleFunnelCompletion(response: AuthResponse) {
        currentUser = response.user
        onboardingCompleted = true
        FeedViewModel.setCurrentUserId(response.user.id)
        isAuthenticated = true
    }

    // MARK: - Login (from the login-only screen)

    func login(email: String, password: String) async {
        error = nil
        do {
            let response = try await APIService.shared.login(email: email, password: password)
            handleAuthSuccess(response)
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Apple Sign-In (from the login screen)

    func handleAppleSignIn(result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            if let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
               let identityTokenData = credential.identityToken,
               let identityToken = String(data: identityTokenData, encoding: .utf8) {

                let email = credential.email
                let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
                    .compactMap { $0 }
                    .joined(separator: " ")

                Task {
                    do {
                        let response = try await APIService.shared.appleAuth(
                            identityToken: identityToken,
                            email: email,
                            fullName: fullName.isEmpty ? nil : fullName
                        )
                        handleAuthSuccess(response)
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
            }
        case .failure(let error):
            self.error = error.localizedDescription
        }
    }

    // MARK: - Onboarding (for edge case: logged in but preferences not set)

    func completeOnboarding() {
        onboardingCompleted = true
    }

    // MARK: - Logout

    func logout() {
        KeychainService.shared.clearTokens()
        FeedViewModel.clearCurrentUserId()
        // Don't clear feed cache — it's validated per-user on restore.
        // Same user logging back in will resume where they left off.
        currentUser = nil
        isAuthenticated = false
        onboardingCompleted = false
        showLogin = false
    }

    // MARK: - Private

    private func handleAuthSuccess(_ response: AuthResponse) {
        KeychainService.shared.saveTokens(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken
        )
        currentUser = response.user
        onboardingCompleted = response.user.onboardingCompleted ?? false
        // Store userId so feed cache is validated per-user
        FeedViewModel.setCurrentUserId(response.user.id)
        isAuthenticated = true
    }
}
