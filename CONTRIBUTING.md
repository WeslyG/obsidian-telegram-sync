## 📢 How You Can Contribute Effectively

Use [repository issues](https://github.com/WeslyG/obsidian-telegram-sync/issues) to discuss bug fixes and feature proposals. Reference the relevant issue in your pull request.

---

## 👨‍💻 Steps to Contribute Code

I'm thrilled you're considering making a contribution to my project! The process is straightforward, and I've outlined the steps below.

1. **Fork the Repository**: To start, click the "Fork" button at the top of the repository page.

2. **Clone the Repository**: In your new fork, click the "Code" button and copy the URL. Then, open your terminal and run the command `git clone [URL]`.

3. **Create a New Branch** from `main` and install dependencies with `npm ci` using Node.js 24.

4. **Make Your Changes**: Now's the time to contribute your changes to the project. Once you're finished, add your changes with `git add .`.

5. **Run the checks** with `npm run check`. Use `npm run build` to also generate the Obsidian bundle. To try a development build in a test vault, run `npm run test:install -- <vault-path>`.

6. **Commit Your Changes**: Commit your changes with `git commit -m "[commit-message]"`.

7. **Commit Message Guidelines**: We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for our commit messages. Here are the basic rules:
    - Commits must be prefixed with a type, which consists of a noun, feat, fix, etc., followed by a colon and a space.
    - The type `feat` should be used when a new feature is added.
    - The type `fix` should be used when a bug is fixed.
    - Use `docs` for documentation changes.
    - Use `style` for formatting changes that do not affect the code's meaning.
    - Use `refactor` when code is changed without adding features or fixing bugs.
    - Use `perf` for code changes that improve performance.
    - Use `test` when adding missing tests or correcting existing tests.
    - The type may be followed by a scope (optional).
    - A description must immediately follow the space after the type/scope prefix.
    - The description is a short description of the code changes, e.g., "Add new user registration module".
    - If needed, provide a longer description after the short description. Separate them by an empty line.

8. **Push Your Changes**: Push your changes to your fork on GitHub by running `git push origin [branch-name]`.

9. **Create a Pull Request** targeting `main`. The **Check and build** job runs the same checks as the local build. Runs on `main` upload the plugin files as a `telegram-sync` artifact.

**🤝 Important Note**: Please make sure to adhere to the coding and commit standards. Commits that do not comply may be rejected.

Thank you for being part of this journey! Your contributions are what keep the project thriving and evolving. 🚀✨

## Publishing a release

1. Run `npm version minor --no-git-tag-version` (or `patch` or `major` as appropriate). Commit the resulting changes to `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` when the minimum Obsidian version changes.
2. When the release commit is at the tip of `main`, tag it with the exact manifest version, for example `git tag 4.1.0 <commit>`. Push it with `git push origin 4.1.0`.
3. In [Actions → Release](https://github.com/WeslyG/obsidian-telegram-sync/actions/workflows/release.yml), select **Run workflow**, choose `main`, and enter the tag without a `v` prefix. The workflow verifies that the tag points to the `main` commit selected for the run, then builds and publishes `main.js`, `manifest.json`, and `styles.css`.
