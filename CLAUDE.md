# OpenGrants Platform

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health



# Coding Conventions & Rules
- Always write clean, maintainable, and type-safe code.
- Run tests before finalizing features.
- Follow existing patterns and file structures in the repository.
- Never print .env or env variables to the command line terminal
# GStack Integration & Roles
When invoked via slash commands, adopt the specific specialist persona:read 
- `/office-hours`: Brainstorming and product direction (YC partner style).
- `/autoplan`: Deconstruct features into structured implementation plans.
- `/review`: Deep code review checking for bugs, edge cases, and style.
- `/qa`: Run browser or integration validation.
- `/ship`: Prepare final commits and pull request hygiene.
- `/investigate` : Use this for any error, get to the route cause of it and solve it in a way that is robust and doesnt cause breaking changes, if they do let the programmer know and get their permission.
