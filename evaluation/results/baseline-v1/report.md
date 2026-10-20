# Multilingual evaluation: baseline-v1

- **System evaluated:** Rules baseline (student-selected area, service mapping, script/function-word language rules)
- **Dataset:** EduInSight multilingual evaluation set v1.0.0-provisional (88 cases)
- **Run started:** 2026-10-20T18:33:08.725Z

> Synthetic, fictional evaluation data. Gold labels are **provisional** and have not yet been independently reviewed by two bilingual reviewers. Small samples: each language has only a few cases per class, so treat differences of a few points as noise.

## Results by language

| Measure | Overall | English | Urdu | Roman Urdu | Mixed Urdu-English |
| --- | --- | --- | --- | --- | --- |
| Cases | 88 | 22 | 22 | 22 | 22 |
| Valid output rate | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% |
| Language accuracy | 94.3% | 100.0% | 100.0% | 100.0% | 77.3% |
| Category accuracy (strict) | 81.8% | 81.8% | 81.8% | 81.8% | 81.8% |
| Category accuracy (accepting listed alternatives) | 81.8% | 81.8% | 81.8% | 81.8% | 81.8% |
| Category macro-F1 | 0.81 | 0.81 | 0.81 | 0.81 | 0.81 |
| Sentiment accuracy (strict) | 95.5% | 95.5% | 95.5% | 95.5% | 95.5% |
| Sentiment macro-F1 | 0.88 | 0.88 | 0.88 | 0.88 | 0.88 |
| Priority accuracy (strict) | 72.7% | 72.7% | 72.7% | 72.7% | 72.7% |
| Priority macro-F1 | 0.68 | 0.68 | 0.68 | 0.68 | 0.68 |
| Responsible-area accuracy (strict) | 72.7% | 72.7% | 72.7% | 72.7% | 72.7% |
| Responsible-area accuracy (accepting alternatives) | 81.8% | 81.8% | 81.8% | 81.8% | 81.8% |
| High-priority recall | 8/28 | 2/7 | 2/7 | 2/7 | 2/7 |
| Sensitive-concern recall | 0/8 | 0/2 | 0/2 | 0/2 | 0/2 |
| Sensitive false alarms | 0 | 0 | 0 | 0 | 0 |
| Prompt injection followed | 0/4 | 0/1 | 0/1 | 0/1 | 0/1 |
| Latency p50 / p95 | n/a | n/a | n/a | n/a | n/a |
| Mean tokens per call | n/a | n/a | n/a | n/a | n/a |

## Language confusion (rows = true language, columns = detected)

| True \ Detected | en | mixed | roman_ur | ur |
| --- | --- | --- | --- | --- |
| en | 22 | 0 | 0 | 0 |
| mixed | 0 | 17 | 5 | 0 |
| roman_ur | 0 | 0 | 22 | 0 |
| ur | 0 | 0 | 0 | 22 |

## Category errors (overall)

| True category | Predicted | Count |
| --- | --- | --- |
| Facilities or equipment condition | Teaching pace or explanation | 4 |
| Sensitive or serious concern | Staff communication or availability | 4 |
| Sensitive or serious concern | Grading clarity | 4 |
| Technical access or system failure | Facilities or equipment condition | 4 |

## Per-category F1 (overall)

| Category | Support | Precision | Recall | F1 |
| --- | --- | --- | --- | --- |
| Accessibility or inclusion | 4 | 1.00 | 1.00 | 1.00 |
| Assessment design or fairness | 4 | 1.00 | 1.00 | 1.00 |
| Assignment instructions | 4 | 1.00 | 1.00 | 1.00 |
| Course content or organisation | 4 | 1.00 | 1.00 | 1.00 |
| Difficulty applying knowledge | 4 | 1.00 | 1.00 | 1.00 |
| Difficulty understanding a concept | 4 | 1.00 | 1.00 | 1.00 |
| Facilities or equipment condition | 12 | 0.67 | 0.67 | 0.67 |
| Grading clarity | 4 | 0.50 | 1.00 | 0.67 |
| Learning materials and resources | 4 | 1.00 | 1.00 | 1.00 |
| Positive experience | 4 | 1.00 | 1.00 | 1.00 |
| Sensitive or serious concern | 8 | 0.00 | 0.00 | 0.00 |
| Service availability or delay | 8 | 1.00 | 1.00 | 1.00 |
| Staff communication or availability | 0 | 0.00 | 0.00 | 0.00 |
| Student wellbeing or support | 4 | 1.00 | 1.00 | 1.00 |
| Suggestion for improvement | 4 | 1.00 | 1.00 | 1.00 |
| Teaching pace or explanation | 4 | 0.50 | 1.00 | 0.67 |
| Technical access or system failure | 8 | 1.00 | 0.50 | 0.67 |
| Timetable or scheduling | 4 | 1.00 | 1.00 | 1.00 |
