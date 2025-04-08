/**
 * CityGML MCP 서버 API 인터페이스
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseConceptModel } from "./parsers/conceptModel.js";
import { parseEncodingDocument } from "./parsers/encoding.js";
import { loadAllSchemas, loadModuleSchema } from "./parsers/schema.js";
import { initCache } from "./utils/cache.js";
import { z } from "zod";
import { SchemaComplexType, SchemaSimpleType } from "./types/schema.js";

// 서버 인스턴스
let serverInstance: McpServer | null = null;

/**
 * CityGML MCP 서버 초기화
 * @returns MCP 서버 인스턴스
 */
export async function initServer(): Promise<McpServer> {
  console.log("CityGML MCP 서버 초기화 중...");
  
  // 서버가 이미 초기화되었는지 확인
  if (serverInstance) {
    return serverInstance;
  }
  
  // 캐시 초기화
  initCache();
  
  // 서버 인스턴스 생성
  const server = new McpServer({
    name: "CityGML-MCP-Server",
    version: "1.0.0",
    description: "CityGML 3.0 Model Context Protocol Server"
  });
  
  // 도구 등록
  registerTools(server);
  
  // 리소스 등록
  registerResources(server);
  
  // 프롬프트 등록
  registerPrompts(server);
  
  // 서버 인스턴스 저장
  serverInstance = server;
  
  console.log("CityGML MCP 서버 초기화 완료");
  return server;
}

/**
 * 도구 등록
 */
function registerTools(server: McpServer): void {
  // 개념 모델 쿼리 도구
  server.tool(
    "query_concept_model",
    {
      query: z.string().describe("검색 쿼리"),
      module: z.string().optional().describe("특정 모듈로 제한(예: 'building', 'transportation')"),
      entity_type: z.enum(["class", "attribute", "module", "association"]).optional().describe("엔티티 유형")
    },
    async ({ query, module, entity_type }) => {
      try {
        const conceptModel = await parseConceptModel();
        let results = [];
        
        // 모듈 필터링
        const targetModules = module 
          ? conceptModel.model.modules.filter(m => m.name.toLowerCase() === module.toLowerCase())
          : conceptModel.model.modules;
        
        // 쿼리 기반 검색
        for (const mod of targetModules) {
          // 엔티티 유형에 따른 검색
          if (!entity_type || entity_type === "module") {
            if (mod.name.toLowerCase().includes(query.toLowerCase()) || 
                mod.description.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                type: "module",
                name: mod.name,
                description: mod.description.substring(0, 100) + "..."
              });
            }
          }
          
          if (!entity_type || entity_type === "class") {
            const matchingClasses = mod.classes.filter(cls => 
              cls.name.toLowerCase().includes(query.toLowerCase()) || 
              cls.description.toLowerCase().includes(query.toLowerCase())
            );
            
            results.push(...matchingClasses.map(cls => ({
              type: "class",
              module: mod.name,
              name: cls.name,
              description: cls.description.substring(0, 100) + "...",
              attributes: cls.attributes.length
            })));
          }
          
          if (!entity_type || entity_type === "attribute") {
            for (const cls of mod.classes) {
              const matchingAttrs = cls.attributes.filter(attr => 
                attr.name.toLowerCase().includes(query.toLowerCase()) || 
                (attr.description && attr.description.toLowerCase().includes(query.toLowerCase()))
              );
              
              results.push(...matchingAttrs.map(attr => ({
                type: "attribute",
                module: mod.name,
                class: cls.name,
                name: attr.name,
                dataType: attr.type,
                cardinality: attr.cardinality
              })));
            }
          }
          
          if (!entity_type || entity_type === "association") {
            for (const cls of mod.classes) {
              if (!cls.associations) continue;
              
              const matchingAssocs = cls.associations.filter(assoc => 
                assoc.name.toLowerCase().includes(query.toLowerCase()) || 
                assoc.target.toLowerCase().includes(query.toLowerCase()) ||
                (assoc.description && assoc.description.toLowerCase().includes(query.toLowerCase()))
              );
              
              results.push(...matchingAssocs.map(assoc => ({
                type: "association",
                module: mod.name,
                source: cls.name,
                target: assoc.target,
                name: assoc.name,
                cardinality: assoc.cardinality
              })));
            }
          }
        }
        
        // 결과 제한
        results = results.slice(0, 20);
        
        return {
          content: [
            { 
              type: "text", 
              text: `CityGML 개념 모델 검색 결과: ${results.length}개 항목 발견\n\n${JSON.stringify(results, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `오류 발생: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
  );
  
  // 스키마 쿼리 도구
  server.tool(
    "query_schema",
    {
      query: z.string().describe("검색 쿼리"),
      module: z.string().optional().describe("특정 모듈로 제한(예: 'building', 'transportation')"),
      element_type: z.enum(["element", "type", "attribute", "group"]).optional().describe("요소 유형")
    },
    async ({ query, module, element_type }) => {
      try {
        // 스키마 레지스트리 로드
        const registry = await loadAllSchemas();
        let results = [];
        
        // 모듈 네임스페이스 획득
        let targetNamespaces: string[] = [];
        if (module && registry.moduleToNamespace[module.toLowerCase()]) {
          targetNamespaces.push(registry.moduleToNamespace[module.toLowerCase()]);
        } else if (!module) {
          targetNamespaces = Object.values(registry.moduleToNamespace);
        } else {
          // 모듈 이름으로 스키마를 찾을 수 없는 경우
          return {
            content: [{ type: "text", text: `모듈 '${module}'를 찾을 수 없습니다.` }],
            isError: true
          };
        }
        
        // 요소 검색
        if (!element_type || element_type === "element") {
          for (const elementName in registry.elementsByName) {
            if (elementName.toLowerCase().includes(query.toLowerCase())) {
              const elements = registry.elementsByName[elementName];
              
              for (const element of elements) {
                const schema = registry.schemas[element.type?.split(':')[0] || '']?.[0];
                const namespace = schema?.targetNamespace || '';
                
                if (targetNamespaces.includes(namespace) || targetNamespaces.length === 0) {
                  results.push({
                    type: "element",
                    name: elementName,
                    xsdType: element.type,
                    namespace,
                    documentation: element.documentation?.substring(0, 100) + "..." || ''
                  });
                }
              }
            }
          }
        }
        
        // 타입 검색
        if (!element_type || element_type === "type") {
          for (const typeName in registry.typesByName) {
            if (typeName.toLowerCase().includes(query.toLowerCase())) {
              const types = registry.typesByName[typeName];
              
              for (const type of types) {
                // 네임스페이스 확인을 위한 임시 로직
                let namespace = '';
                for (const ns in registry.schemas) {
                  if (registry.schemas[ns].some(s => 
                    s.complexTypes.some(t => t.name === typeName) || 
                    s.simpleTypes.some(t => t.name === typeName)
                  )) {
                    namespace = ns;
                    break;
                  }
                }
                
                if (targetNamespaces.includes(namespace) || targetNamespaces.length === 0) {
                  const isComplexType = "abstract" in type;
                  results.push({
                    type: isComplexType ? "complex_type" : "simple_type",
                    name: typeName,
                    isAbstract: isComplexType ? (type as SchemaComplexType).abstract || false : false,
                    base: isComplexType ? (type as SchemaComplexType).base : undefined,
                    namespace,
                    documentation: type.documentation?.substring(0, 100) + "..." || ''
                  });
                }
              }
            }
          }
        }
        
        // 결과 제한
        results = results.slice(0, 20);
        
        return {
          content: [
            { 
              type: "text", 
              text: `CityGML 스키마 검색 결과: ${results.length}개 항목 발견\n\n${JSON.stringify(results, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `오류 발생: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
  );
  
  // 인코딩 예제 검색 도구
  server.tool(
    "find_encoding_examples",
    {
      class_name: z.string().describe("클래스 이름(예: 'Building', 'CityModel')"),
      language: z.enum(["XML", "JSON", "SQL", "Other"]).optional().describe("예제 언어 필터")
    },
    async ({ class_name, language }) => {
      try {
        const encodingDoc = await parseEncodingDocument();
        const examples = encodingDoc.model.examples.filter(example => 
          example.relatedClasses.includes(class_name) && 
          (!language || example.language === language)
        );
        
        if (examples.length === 0) {
          return {
            content: [{ type: "text", text: `'${class_name}'에 대한 인코딩 예제를 찾을 수 없습니다.` }]
          };
        }
        
        // 결과 포맷팅
        const resultText = examples.map(example => (
          `# ${example.title}\n` +
          `Language: ${example.language}\n` +
          `\`\`\`${example.language.toLowerCase()}\n` +
          `${example.code}\n` +
          `\`\`\`\n\n`
        )).join('');
        
        return {
          content: [
            { 
              type: "text", 
              text: `${class_name}에 대한 인코딩 예제 (${examples.length}개 발견):\n\n${resultText}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `오류 발생: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
  );
}

/**
 * 리소스 등록
 */
function registerResources(server: McpServer): void {
  // 구현 예정
}

/**
 * 프롬프트 등록
 */
function registerPrompts(server: McpServer): void {
  // 구현 예정
}

/**
 * 서버 인스턴스 가져오기
 */
export function getServer(): McpServer {
  if (!serverInstance) {
    throw new Error("서버가 초기화되지 않았습니다. 먼저 initServer()를 호출하세요.");
  }
  return serverInstance;
} 