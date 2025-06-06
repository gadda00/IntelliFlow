# Contributing to IntelliFlow

Thank you for considering contributing to IntelliFlow! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct, which promotes a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Bugs

If you find a bug in the project, please create an issue in the GitHub repository with the following information:

- A clear, descriptive title
- A detailed description of the bug
- Steps to reproduce the bug
- Expected behavior
- Actual behavior
- Screenshots or logs (if applicable)
- Environment information (OS, browser, etc.)

### Suggesting Enhancements

If you have an idea for an enhancement, please create an issue with the following information:

- A clear, descriptive title
- A detailed description of the enhancement
- The motivation behind the enhancement
- Any potential implementation details

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`
3. Make your changes
4. Run tests to ensure your changes don't break existing functionality
5. Submit a pull request

#### Pull Request Guidelines

- Follow the coding style and conventions used in the project
- Include tests for new functionality
- Update documentation as needed
- Keep pull requests focused on a single change
- Reference any related issues in the pull request description

## Contributing to ADK through IntelliFlow

IntelliFlow actively contributes to the [Google Agent Development Kit (ADK) Python repository](https://github.com/google/adk-python). If you're interested in contributing to the ADK through IntelliFlow:

1. Check the existing contributions in the `adk_contributions` directory
2. Identify an area for improvement in the ADK
3. Implement your changes in the appropriate subdirectory:
   - `bug_fixes`: For patches and fixes to ADK issues
   - `documentation`: For enhanced documentation and tutorials
   - `features`: For new functionality
   - `examples`: For sample implementations
4. Create tests to validate your changes
5. Submit a pull request to the IntelliFlow repository
6. After review and approval, we'll submit the contribution to the ADK repository

You can view our existing pull requests and contributions to the ADK here:
- [https://github.com/google/adk-python/pulls](https://github.com/google/adk-python/pulls)

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/gadda00/IntelliFlow.git
cd IntelliFlow
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure Google Cloud credentials:
```bash
gcloud auth application-default login
```

4. Set up configuration:
```bash
cp config/default.yaml config/development.yaml
# Edit development.yaml with your settings
```

5. Run tests:
```bash
pytest
```

## Coding Standards

- Follow PEP 8 style guidelines for Python code
- Write docstrings for all functions, classes, and modules
- Maintain test coverage for all code
- Use meaningful variable and function names
- Keep functions and methods focused on a single responsibility

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests after the first line

## Testing

- Write unit tests for all new functionality
- Ensure all tests pass before submitting a pull request
- Maintain or improve test coverage

## Documentation

- Update documentation for any changes to the API or functionality
- Use clear, concise language
- Include examples where appropriate

## Live Demo

You can access the live demo of IntelliFlow at:
- [https://intelli-flow-brown.vercel.app/](https://intelli-flow-brown.vercel.app/)

## Team

- **Victor Ndunda** - Lead Developer

Thank you for contributing to IntelliFlow!

