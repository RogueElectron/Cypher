# Cypher Documentation
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/RogueElectron/Cypher)
HEY, MAJOR CHANGES, all docs were removed becuse they were old and im working on the new docs

Welcome to the Cypher project documentation. This guide provides comprehensive information about the system architecture, implementation details, and development workflows.

## NOTICE

- This project is in active development and is a prototype, please take in mind:

- The server doesn't hardcode secrets but generates them on each run
- The server doesn't have presistent storage but instead uses wrappers around ```map()```
- The time on both the server machine and the user machine MUST BE CORRECT for TOTP to work correctly

- This project is tested on Debian 12


## Digitopia specifics

**Digitopia Jury?, these materials concern you.**

- [**Business Model**](Documentation/Business-Model.md) - complete business model
- [**Team Roles**](Documentation/Team-Roles.md) - team roles
- [**Simple Guide**](Documentation/Simple-Guide.md) - quick guide to understand how cypher works without getting into much details

## Documentation Index

### System Architecture & Overview
- [**System Architecture**](Documentation/System-Architecture.md) - High-level system design and component relationships
- [**Implementation Details**](Documentation/Implementation-Details.md) - Technical implementation specifics
- [**Security Model**](Documentation/Security-Model.md) - Security architecture and threat model

###  Authentication & Security
- [**Authentication System Overview**](Documentation/Authentication-System-Overview.md) - Complete authentication system design
- [**Authentication Workflows**](Documentation/Authentication-Workflows.md) - Detailed authentication flow diagrams
- [**User Registration Process**](Documentation/User-Registration-Process.md) - User signup and account creation
- [**User Login Process**](Documentation/User-Login-Process.md) - Login flow and validation
- [**Session Management**](Documentation/Session-Management.md) - Session handling and lifecycle

### Backend Services
- [**Backend Services**](Documentation/Backend-Services.md) - Overview of all backend components
- [**Flask Session Service**](Documentation/Flask-Session-Service.md) - Flask-based session management
- [**Node.js API**](Documentation/Node.js-API.md) - Node.js API endpoints and services

### Frontend Components
- [**Frontend Components**](Documentation/Frontend-Components.md) - Complete frontend architecture
- [**Client-Side Components**](Documentation/Client-Side-Components.md) - Client-side implementation details

### Development & Setup
- [**Development Guide**](Documentation/Development-Guide.md) - Development environment and workflow
- [**Setup and Dependencies**](Documentation/Setup-and-Dependencies.md) - Installation and configuration
- [**Build System and Assets**](Documentation/Build-System-and-Assets.md) - Build process and asset management

## Quick Start

1. **New to the project?** Start with [System Architecture](Documentation/System-Architecture.md)
2. **Setting up development?** Check [Setup and Dependencies](Documentation/Setup-and-Dependencies.md)
3. **Working on authentication?** Review [Authentication System Overview](Documentation/Authentication-System-Overview.md)
4. **Frontend development?** See [Frontend Components](Documentation/Frontend-Components.md)

## Documentation Structure

Each document follows a consistent structure with:
- Overview and purpose
- Technical specifications
- Code examples where applicable
- Related documentation links
