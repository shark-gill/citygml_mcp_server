[![MseeP Badge](https://mseep.net/pr/shark-gill-citygml-mcp-server-badge.jpg)](https://mseep.ai/app/shark-gill-citygml-mcp-server)

# CityGML MCP 서버

이 프로젝트는 [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/typescript-sdk)을 사용하여 CityGML 데이터에 접근할 수 있는 서버를 구현합니다.

## 설치

```bash
npm install
```

## 빌드

```bash
npm run build
```

## 실행

### 기본(stdio) 서버 실행:
```bash
npm start
```

### HTTP 서버 실행:
```bash
node dist/http-server.js --http
```

### 클라이언트 실행:
```bash
node dist/client.js
```

## 기능

1. **에코 리소스**: 메시지를 에코하는 간단한 리소스 구현
2. **에코 도구**: 메시지를 에코하는 도구 구현
3. **에코 프롬프트**: 메시지 포맷팅을 위한 프롬프트 구현

## 구조

- `src/index.ts`: 기본 stdio 기반 MCP 서버 구현
- `src/http-server.ts`: HTTP 및 SSE 기반 MCP 서버 구현
- `src/client.ts`: MCP 클라이언트 예제

## 참고 자료

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP 문서](https://modelcontextprotocol.io/) 