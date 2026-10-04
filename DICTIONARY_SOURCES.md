# Word Duel Master Dictionary sources

Word Duel's master dictionary is built from the American English Hunspell dictionary in the LibreOffice dictionaries project, a SCOWL-derived English word-list distribution, plus the NWL23 cheat-sheet words supplied by the Word Duel project owner.

## SCOWL / Hunspell source
- Source file: LibreOffice/dictionaries `en/en_US.dic`
- Affix rules: LibreOffice/dictionaries `en/en_US.aff`
- Source documentation: LibreOffice/dictionaries `en/README_en_US.txt`
- Filtering used by Word Duel: alphabetic lowercase source entries only, expanded with Hunspell affix rules, restricted to 2–11 letters, with an explicit small abbreviation blocklist. Lowercase-only source filtering excludes the source's obvious proper-name and acronym entries.
- SCOWL licensing/attribution is preserved in the upstream README and permits use/copy/modification/distribution subject to its notices.

## NWL23 cheat-sheet additions
The 831 words previously added from the user-supplied NWL23 cheat sheet are preserved in the master dictionary. This does not make Word Duel's dictionary the official NWL23 lexicon.

## Counts
- Previous Word Duel dictionary: 112498 unique 2–11-letter entries
- Clean SCOWL-derived set after filtering/affix expansion: 68614
- NWL23 cheat-sheet additions preserved: 831
- Final Word Duel Master Dictionary: 69289 unique 2–11-letter entries
