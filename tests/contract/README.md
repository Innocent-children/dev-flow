# Repository Contract Tests

These Go tests validate the Feature 001 repository layout, package manifests, pull-request CI, and
repository-relative Markdown links. Invalid layouts are materialized only in temporary directories;
the valid checkout never contains a nested Spec Kit project or nested Go module fixture.
