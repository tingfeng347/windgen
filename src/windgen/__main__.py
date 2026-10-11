import uvicorn

from windgen.config import settings


def main():
    uvicorn.run("windgen.api:app", host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
