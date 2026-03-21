import SwiftUI

struct RootView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            if authViewModel.isLoading {
                // 1. Checking auth state — show splash
                SplashView()
            } else if !authViewModel.isAuthenticated && authViewModel.showLogin {
                // 2a. User tapped "Already have an account?" — login screen
                AuthView()
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .trailing).combined(with: .opacity)
                    ))
            } else if !authViewModel.isAuthenticated {
                // 2b. New user — onboarding funnel (purpose → categories → time → signup)
                OnboardingView()
                    .transition(.asymmetric(
                        insertion: .move(edge: .leading).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
            } else if !authViewModel.onboardingCompleted {
                // 3. Edge case: logged in via login but never set preferences
                //    (e.g., account created externally or preferences cleared)
                OnboardingView()
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
            } else {
                // 4. Fully set up — main app
                MainTabView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.4), value: authViewModel.isAuthenticated)
        .animation(.easeInOut(duration: 0.4), value: authViewModel.onboardingCompleted)
        .animation(.easeInOut(duration: 0.3), value: authViewModel.isLoading)
        .animation(.easeInOut(duration: 0.35), value: authViewModel.showLogin)
        .onChange(of: authViewModel.isAuthenticated) { _, isAuthenticated in
            if isAuthenticated {
                // Always land on Feed tab after login
                appState.selectedTab = .feed
            }
        }
    }
}
