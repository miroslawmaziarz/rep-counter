# Rep Counter

A Patient does squats in front of a camera; the app counts the Reps in each Session and keeps the Patient's history of Session Results.

## Language

**Patient**:
The person doing the exercise and the only kind of caller; every Session Result belongs to exactly one Patient.
_Avoid_: User, account, client

**Session**:
One exercise attempt by a Patient, identified by a `sessionId`.
_Avoid_: Workout, set

**Recording**:
The knee angle of every frame of a Session, captured at a fixed sample rate; it never leaves the browser.
_Avoid_: Session (for the angle data), signal, trace

**Knee Angle**:
The angle at the knee in a single frame, in degrees: about 172° standing, about 90° in a deep squat.
_Avoid_: Angle value, sample

**Rep**:
One squat that counts: the Knee Angle goes below the deep Rep Threshold, then back above the standing one (100° and 160° unless set otherwise).
_Avoid_: Repetition, squat (when meaning a counted one), attempt

**Rep Thresholds**:
The two Knee Angles a Rep is measured against: how deep the squat must go, and how far back up the Patient must stand. The brief's values are 100° and 160°.
_Avoid_: Limits, bounds, cut-offs

**Session Result**:
What is kept about a Session: its `sessionId`, Rep count, duration and when it was performed.
_Avoid_: Session (for the stored record), summary

**Resend**:
A Session Result sent again for a `sessionId` the Patient has already saved; it is saved once. A conflicting Resend carries different values and is refused.
_Avoid_: Duplicate, retry (for the arriving copy)

**Fixture**:
A sample Recording shipped with the repo, labelled with the Rep count it should produce.
_Avoid_: Test session, sample file
