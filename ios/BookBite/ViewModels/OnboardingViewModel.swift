import SwiftUI

// MARK: - Reading Purpose

enum ReadingPurpose: String, CaseIterable, Identifiable {
    case growth = "Personal Growth"
    case knowledge = "Learn New Things"
    case entertainment = "Relax & Enjoy"
    case professional = "Career & Business"
    case curiosity = "Explore Everything"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .growth: return "arrow.up.heart"
        case .knowledge: return "brain.head.profile"
        case .entertainment: return "sparkles"
        case .professional: return "briefcase"
        case .curiosity: return "globe"
        }
    }

    var subtitle: String {
        switch self {
        case .growth: return "Motivation, habits, mindset"
        case .knowledge: return "Science, history, psychology"
        case .entertainment: return "Fiction, stories, biographies"
        case .professional: return "Strategy, leadership, tech"
        case .curiosity: return "A bit of everything"
        }
    }

    /// Suggested categories for this purpose
    var suggestedCategories: Set<BookCategory> {
        switch self {
        case .growth:
            return [.selfHelp, .psychology, .spirituality, .philosophy]
        case .knowledge:
            return [.science, .history, .philosophy, .psychology]
        case .entertainment:
            return [.fiction, .romance, .biography, .history]
        case .professional:
            return [.business, .technology, .economics, .selfHelp]
        case .curiosity:
            return Set(BookCategory.allCases.prefix(6))
        }
    }
}

// MARK: - ViewModel

@MainActor
class OnboardingViewModel: ObservableObject {
    // Preference state
    @Published var selectedPurpose: ReadingPurpose?
    @Published var selectedCategories: Set<BookCategory> = []
    @Published var selectedReadingTimes: Set<ReadingTime> = [.threeMin]

    // Signup state
    @Published var email = ""
    @Published var password = ""
    @Published var displayName = ""

    // Navigation
    @Published var currentStep = 0
    @Published var isSubmitting = false
    @Published var error: String?

    let totalSteps = 4 // Purpose → Categories → Reading Time → Sign Up

    var progress: Double {
        Double(currentStep + 1) / Double(totalSteps)
    }

    // MARK: - Purpose

    func selectPurpose(_ purpose: ReadingPurpose) {
        selectedPurpose = purpose
        selectedCategories = purpose.suggestedCategories
    }

    // MARK: - Categories

    func toggleCategory(_ category: BookCategory) {
        if selectedCategories.contains(category) {
            selectedCategories.remove(category)
        } else {
            selectedCategories.insert(category)
        }
    }

    // MARK: - Reading Time

    func toggleReadingTime(_ time: ReadingTime) {
        if selectedReadingTimes.contains(time) {
            if selectedReadingTimes.count > 1 {
                selectedReadingTimes.remove(time)
            }
        } else {
            selectedReadingTimes.insert(time)
        }
    }

    // MARK: - Navigation

    func nextStep() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            if currentStep < totalSteps - 1 {
                currentStep += 1
            }
        }
    }

    func previousStep() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            if currentStep > 0 {
                currentStep -= 1
            }
        }
    }

    var isContinueDisabled: Bool {
        switch currentStep {
        case 0: return selectedPurpose == nil
        case 1: return selectedCategories.count < 3
        case 2: return selectedReadingTimes.isEmpty
        case 3: return !isSignupFormValid
        default: return false
        }
    }

    // MARK: - Signup Validation

    var isSignupFormValid: Bool {
        !email.isEmpty && !password.isEmpty && !displayName.isEmpty && password.count >= 8
    }

    // MARK: - Combined Submit (register + save preferences)

    /// Register the account, then immediately save preferences.
    /// Returns the AuthResponse on success, nil on failure.
    func registerAndSavePreferences() async -> AuthResponse? {
        isSubmitting = true
        error = nil

        do {
            // 1. Create account
            let authResponse = try await APIService.shared.register(
                email: email,
                password: password,
                displayName: displayName
            )

            // 2. Save tokens so the preferences call is authenticated
            KeychainService.shared.saveTokens(
                accessToken: authResponse.accessToken,
                refreshToken: authResponse.refreshToken
            )

            // 3. Save preferences + mark onboarding complete
            let _ = try await APIService.shared.updatePreferences(
                bookCategories: selectedCategories.map(\.rawValue),
                preferredReadingTimes: selectedReadingTimes.map(\.rawValue).sorted(),
                onboardingCompleted: true
            )

            isSubmitting = false
            return authResponse
        } catch let apiError as APIError {
            error = apiError.localizedDescription
            isSubmitting = false
            return nil
        } catch {
            self.error = error.localizedDescription
            isSubmitting = false
            return nil
        }
    }

    /// For social auth (Apple/Google), save preferences after auth succeeds externally.
    func savePreferencesOnly() async -> Bool {
        do {
            let _ = try await APIService.shared.updatePreferences(
                bookCategories: selectedCategories.map(\.rawValue),
                preferredReadingTimes: selectedReadingTimes.map(\.rawValue).sorted(),
                onboardingCompleted: true
            )
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
}
