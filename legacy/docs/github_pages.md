# GitHub Pages Configuration for IntelliFlow

This document provides information about the GitHub Pages setup for the IntelliFlow project.

## Overview

The IntelliFlow project has been configured to work on GitHub Pages, allowing for easy access to the frontend interface without requiring a backend server. This is achieved through the following modifications:

1. **Base Path Configuration**: The Vite build system has been configured with the correct base path for GitHub Pages.
2. **Mock API Implementation**: A mock API service has been implemented to simulate backend functionality.
3. **SPA Routing Support**: Client-side routing has been configured to work properly on GitHub Pages.
4. **Automated Deployment**: A GitHub Actions workflow has been set up for automated deployment.

## Mock API

Since GitHub Pages only supports static content, a mock API service has been implemented to simulate the backend functionality. This allows the frontend to function independently without requiring a running backend server.

The mock API provides simulated data for:
- Data sources
- Analysis types
- Analysis history
- Analysis results

## Deployment Process

The project is automatically deployed to GitHub Pages whenever changes are pushed to the main branch. This is handled by the GitHub Actions workflow defined in `.github/workflows/deploy.yml`.

## Local Development

For local development, the application will continue to use the real API endpoints if available. The mock API is only used when deployed to GitHub Pages.

## Future Improvements

To further enhance the GitHub Pages deployment, consider:

1. Implementing more comprehensive mock data
2. Adding a toggle to switch between mock and real API in development
3. Enhancing the visualization capabilities in the static deployment

## Troubleshooting

If you encounter issues with the GitHub Pages deployment:

1. Check that the GitHub Pages site is enabled in the repository settings
2. Verify that the GitHub Actions workflow has completed successfully
3. Clear browser cache if you're seeing outdated content
