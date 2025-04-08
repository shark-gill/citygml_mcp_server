import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";
// __dirname 설정 (ESM에서는 __dirname이 없음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 클라이언트 인스턴스 생성
const client = new Client({
    name: "CityGML-MCP-Client",
    version: "1.0.0"
});
// Stdio를 통해 서버와 연결
async function connectToServer() {
    console.log("MCP 서버에 연결 중...");
    // 서버 전송 설정 (index.js를 실행하는 node 프로세스 사용)
    const transport = new StdioClientTransport({
        command: "node",
        args: [path.join(__dirname, "..", "dist", "index.js")]
    });
    // 서버에 연결
    await client.connect(transport);
    console.log("서버에 연결되었습니다!");
    // 1. 프롬프트 목록 가져오기
    const prompts = await client.listPrompts();
    console.log("사용 가능한 프롬프트:", prompts);
    // 2. 에코 도구 호출
    const echoResult = await client.callTool({
        name: "echo",
        arguments: {
            message: "안녕하세요, MCP!"
        }
    });
    console.log("에코 도구 응답:", echoResult);
    // 3. 에코 리소스 읽기
    const resourceResult = await client.readResource({
        uri: "echo://%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EB%A9%94%EC%8B%9C%EC%A7%80"
    });
    console.log("에코 리소스 응답:", resourceResult);
    // 4. 에코 프롬프트 가져오기
    const promptResult = await client.getPrompt({
        name: "echo",
        arguments: {
            message: "프롬프트 테스트"
        }
    });
    console.log("에코 프롬프트:", promptResult);
    // 연결 종료
    await transport.close();
    console.log("연결을 종료했습니다");
}
// 클라이언트 실행
connectToServer().catch(err => {
    console.error("오류 발생:", err);
    process.exit(1);
});
