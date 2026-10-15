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
One squat that counts: the Knee Angle goes below 100°, then comes back above 160°.
_Avoid_: Repetition, squat (when meaning a counted one), attempt

**Rep Thresholds**:
The two Knee Angles that define a Rep: `deepBelow` (100° by default) arms it and `standingAbove` (160° by default) completes it; both are strict.
_Avoid_: Limits, bounds, cut-offs

**Session Result**:
What is kept about a Session: its `sessionId`, Rep count, duration and when it was performed.
_Avoid_: Session (for the stored record), summary

**Fixture**:
A sample Recording shipped with the repo, labelled with the Rep count it should produce.
_Avoid_: Test session, sample file
