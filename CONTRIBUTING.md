# Contributing to FreezeScope engine

Start with the role and coverage boundary in README.md. Open an issue with a concrete unsupported case, expected CAP-77 rule and a reproducible public fixture before expanding coverage. Do not replace INCOMPLETE with a success result without proving every relevant access is modeled.

For changes, include the smallest regression that would fail before the fix. Do not commit funded identities, private keys, personal incident data or confidential recovery plans. Synthetic examples must be labeled. A public simulation transcript is evidence of what was recorded, not proof that a real freeze occurred.

All five repositories compose through sibling paths. Run the applicable tests described in README.md. Contract changes require `cargo test --locked` and a supported `stellar contract build --locked` build. Update the evidence limitations whenever coverage changes.
