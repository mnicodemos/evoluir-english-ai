# Synchronize the Vocabulary availability state

## Scope
- Make the Vocabulary indicator depend only on saved words in the current lesson round.
- Keep the indicator hidden while that saved-word check is loading or has failed.
- Treat an empty saved batch as unavailable, without triggering generation or any other AI request.
- Keep the existing manual retry behavior and show the neutral message: “No new words available right now. Please try again later.”

## Validation
- Add focused tests for saved words, empty results, loading, and read/generation errors.
- Run the relevant tests and project validation.

## Technical details
- Reuse the existing vocabulary batch query and activity-indicator helpers.
- Do not change generation, prompts, CEFR, mastery, evidence, progression, database structure, or backend behavior.
