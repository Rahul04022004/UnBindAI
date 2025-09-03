# UnBind - Legal Document Analysis Platform

## Project Overview

UnBind is an AI-powered legal document analysis application that uses RAG (Retrieval-Augmented Generation) technology to simplify complex legal documents into easy-to-understand explanations. Built for the Recursive v2 Hackathon, this platform combines modern web technologies with advanced AI capabilities.

## Features

### Core Features
- **Document Upload & Management**: Support for PDF, DOCX, DOC, and TXT files
- **AI-Powered Analysis**: Uses GROQ API and RAG technology for document understanding
- **User Authentication**: Secure login/signup system with JWT tokens
- **Responsive UI**: Modern, professional interface built with Next.js and Tailwind CSS
- **Real-time Processing**: Document analysis with progress tracking

### Technical Features
- **RAG Implementation**: Document chunking, vector embeddings, and similarity search
- **FastAPI Backend**: High-performance Python backend with automatic API documentation
- **Next.js Frontend**: React-based frontend with TypeScript and modern patterns
- **Database Integration**: PostgreSQL with Supabase for data persistence
- **File Processing**: Support for multiple document formats with text extraction

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **SQLAlchemy**: Database ORM
- **GROQ API**: AI model integration
- **LangChain**: RAG framework
- **ChromaDB**: Vector database
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **React Hook Form**: Form management
- **React Dropzone**: File upload handling
- **Lucide React**: Icon library

### Infrastructure
- **Docker**: Containerization
- **Docker Compose**: Multi-service orchestration
- **Supabase**: Database and authentication services

## Project Structure

```
UnBind/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/v1/         # API endpoints
│   │   ├── core/           # Configuration and utilities
│   │   ├── models/         # Database models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # Business logic (RAG, etc.)
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile         # Backend container
├── frontend/               # Next.js frontend
│   ├── app/               # App Router pages
│   ├── components/        # Reusable components
│   ├── package.json       # Node.js dependencies
│   └── Dockerfile         # Frontend container
├── shared/                 # Shared types and utilities
│   ├── types/             # TypeScript interfaces
│   └── utils/             # Common utilities
├── docker-compose.yml      # Development environment
├── package.json           # Root workspace config
└── README.md              # This file
```

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd UnBind
```

### 2. Environment Setup
```bash
# Copy environment template
cp env.example .env

# Edit .env with your API keys and configuration
# Required variables:
# - GROQ_API_KEY: Your GROQ API key
# - SUPABASE_URL: Your Supabase project URL
# - SUPABASE_ANON_KEY: Your Supabase anonymous key
# - JWT_SECRET: Random secret for JWT tokens
```

### 3. Start with Docker (Recommended)
```bash
# Install dependencies and start all services
npm run install:all

# Start the development environment
npm run dev

# This will start:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:8000
# - Database: localhost:5432
# - Redis: localhost:6379
```

### 4. Local Development Setup
```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

## API Documentation

Once the backend is running, you can access:
- **Interactive API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/documents/upload` - Document upload
- `POST /api/v1/documents/{id}/analyze` - Trigger document analysis
- `GET /api/v1/documents` - List user documents

## RAG Implementation

The RAG (Retrieval-Augmented Generation) system works as follows:

1. **Document Processing**: Documents are chunked into smaller segments
2. **Embedding Generation**: Text chunks are converted to vector embeddings
3. **Vector Storage**: Embeddings are stored in ChromaDB for similarity search
4. **Query Processing**: User queries are converted to embeddings
5. **Retrieval**: Similar document chunks are retrieved from the vector database
6. **Generation**: GROQ API generates simplified explanations using retrieved context

## Database Schema

### Users Table
- `id`: Primary key
- `email`: Unique email address
- `password_hash`: Encrypted password
- `first_name`, `last_name`: User information
- `is_active`, `is_verified`: Account status flags

### Documents Table
- `id`: Primary key
- `user_id`: Foreign key to users
- `filename`: Stored filename
- `original_filename`: Original filename
- `file_path`: File storage path
- `status`: Document processing status

### Analyses Table
- `id`: Primary key
- `document_id`: Foreign key to documents
- `analysis_type`: Type of analysis performed
- `simplified_text`: AI-generated simplified explanation
- `confidence_score`: Analysis confidence (0-100)

## Development Workflow

### Adding New Features
1. Create feature branch from `main`
2. Implement backend API endpoints
3. Add frontend components and pages
4. Update shared types if needed
5. Test thoroughly
6. Submit pull request

### Code Quality
- Use TypeScript throughout the frontend
- Follow FastAPI best practices
- Implement proper error handling
- Add comprehensive logging
- Write unit tests for critical functions

## Deployment

### Production Considerations
- Use environment-specific configurations
- Implement proper logging and monitoring
- Set up CI/CD pipelines
- Configure SSL certificates
- Implement rate limiting
- Set up backup strategies

### Environment Variables
```bash
# Production environment variables
NODE_ENV=production
DATABASE_URL=your_production_db_url
GROQ_API_KEY=your_production_groq_key
SUPABASE_URL=your_production_supabase_url
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is built for the Recursive v2 Hackathon. Please refer to the hackathon guidelines for usage rights.

## Support

For questions or issues:
- Check the API documentation at `/docs`
- Review the codebase structure
- Open an issue in the repository

## Future Enhancements

- **OAuth Integration**: Google, GitHub authentication
- **Advanced Analysis**: Risk assessment, compliance checking
- **Collaboration**: Document sharing and team features
- **Export Options**: PDF, DOCX export of analyses
- **Mobile App**: React Native mobile application
- **API Rate Limiting**: Usage-based pricing tiers
