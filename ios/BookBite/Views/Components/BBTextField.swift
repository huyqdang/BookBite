import SwiftUI

struct BBTextField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure: Bool = false
    var icon: String? = nil

    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: 12) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundColor(isFocused ? BBColors.text : BBColors.textTertiary)
                    .frame(width: 20)
            }

            if isSecure {
                SecureField(placeholder, text: $text)
                    .focused($isFocused)
            } else {
                TextField(placeholder, text: $text)
                    .focused($isFocused)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
        }
        .font(BBFonts.bodyLarge())
        .padding(.horizontal, BBSpacing.md)
        .padding(.vertical, 14)
        .background(BBColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: BBRadius.md)
                .stroke(
                    isFocused ? BBColors.primary : BBColors.border,
                    lineWidth: isFocused ? 1.5 : 1
                )
        )
        .animation(.easeInOut(duration: 0.2), value: isFocused)
    }
}
