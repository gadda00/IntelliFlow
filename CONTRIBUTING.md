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

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/intelliflow.git
cd intelliflow
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

Thank you for contributing to IntelliFlow!
