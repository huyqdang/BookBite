import SwiftUI

@main
struct BookBiteApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authViewModel)
                .environmentObject(appState)
                .preferredColorScheme(.light)
        }
    }
}

class AppState: ObservableObject {
    @Published var selectedTab: Tab = .feed

    enum Tab: String, CaseIterable {
        case feed = "Feed"
        case bookmarks = "Bookmarks"
        case profile = "Profile"
    }
}
