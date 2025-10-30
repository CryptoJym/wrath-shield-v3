Complete a Task Master task: $ARGUMENTS

Steps:

1. Review the current task with `task-master show $ARGUMENTS`
2. Verify all implementation is complete and tests pass: `npm test`
3. Mark as complete: `task-master set-status --id=$ARGUMENTS --status=done`
4. Validate dependencies: `task-master validate-dependencies`
5. Regenerate files: `task-master generate`
6. Show the next available task: `task-master next`

