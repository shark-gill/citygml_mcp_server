import express from "express";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
// MCP 서버 인스턴스 생성
const server = new McpServer({
    name: "CityGML-MCP-HTTP-Server",
    version: "1.0.0"
});
// 리소스 등록
server.resource("echo", new ResourceTemplate("echo://{message}", { list: undefined }), async (uri, { message }) => ({
    contents: [{
            uri: uri.href,
            text: `리소스 응답: ${message}`
        }]
}));
// 도구 등록
server.tool("echo", { message: z.string() }, async ({ message }) => ({
    content: [{ type: "text", text: `도구 응답: ${message}` }]
}));
// 프롬프트 등록
server.prompt("echo", { message: z.string() }, ({ message }) => ({
    messages: [{
            role: "user",
            content: {
                type: "text",
                text: `메시지 처리: ${message}`
            }
        }]
}));
// 서버 시작 함수
async function startHttpServer() {
    console.log("HTTP MCP 서버 시작 중...");
    const app = express();
    const port = 3001;
    // 여러 연결을 지원하기 위한 트랜스포트 관리
    const transports = {};
    // SSE 엔드포인트 설정
    app.get("/sse", async (_, res) => {
        const transport = new SSEServerTransport('/messages', res);
        transports[transport.sessionId] = transport;
        res.on("close", () => {
            delete transports[transport.sessionId];
        });
        await server.connect(transport);
    });
    // 메시지 엔드포인트 설정
    app.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        if (transport) {
            await transport.handlePostMessage(req, res);
        }
        else {
            res.status(400).send('세션 ID에 해당하는 트랜스포트를 찾을 수 없습니다');
        }
    });
    // 서버 시작
    app.listen(port, () => {
        console.log(`HTTP MCP 서버가 http://localhost:${port}에서 실행 중입니다`);
    });
}
// 명령줄 인수가 'http'인 경우에만 HTTP 서버 시작
if (process.argv.includes('--http')) {
    startHttpServer().catch(err => {
        console.error("HTTP 서버 시작 중 오류 발생:", err);
        process.exit(1);
    });
}
