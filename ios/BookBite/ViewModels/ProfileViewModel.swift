import SwiftUI

@MainActor
class ProfileViewModel: ObservableObject {
    @Published var profile: ProfileResponse?
    @Published var isLoading = false
    @Published var error: String?

    func loadProfile() async {
        isLoading = true
        do {
            profile = try await APIService.shared.getProfile()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func updatePreferences(categories: [String], readingTimes: [Int]) async {
        do {
            let _ = try await APIService.shared.updatePreferences(
                bookCategories: categories,
                preferredReadingTimes: readingTimes,
                onboardingCompleted: true
            )
            await loadProfile()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
