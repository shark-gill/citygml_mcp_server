import * as path from 'path';
import * as fs from 'fs';
import express from 'express';
import { ConceptExtractor } from './extractors/concepts.js';
import { ObjectExtractor } from './extractors/objects.js';
import { AttributeExtractor } from './extractors/attributes.js';
import { RelationshipExtractor } from './extractors/relationships.js';
// MCP SDK 관련 코드 임시 주석 처리
// @ts-ignore: MCP SDK 타입 정의를 임시로 무시합니다
// import { MCPServer, createServer } from '@modelcontextprotocol/sdk';
// 서버 설정
const app = express();
const PORT = process.env.PORT || 3000;
// XSD 파일 경로
const XSD_BASE_PATH = path.join(process.cwd(), 'xsds');
// JSON 미들웨어 설정
app.use(express.json());
// 기본 경로
app.get('/', (req, res) => {
    res.json({
        message: 'CityGML MCP(Model Context Protocol) 서버',
        endpoints: [
            { path: '/api/concepts', description: '개념 정보 추출' },
            { path: '/api/objects', description: '객체 정보 추출' },
            { path: '/api/attributes', description: '속성 정보 추출' },
            { path: '/api/relationships', description: '관계 정보 추출' }
        ]
    });
});
// 개념 추출 API
app.get('/api/concepts', (req, res) => {
    try {
        // 비동기 함수를 즉시 실행 함수로 래핑하여 사용
        (async () => {
            const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
            const conceptModel = await conceptExtractor.extractAllModules();
            // 분류 체계 데이터 생성
            const classification = {};
            // 모듈별로 클래스 분류
            for (const module of conceptModel.modules) {
                classification[module.name] = module.classes.map(c => c.name);
            }
            res.json({
                version: conceptModel.version,
                moduleCount: conceptModel.modules.length,
                modules: conceptModel.modules.map(m => ({
                    name: m.name,
                    namespace: m.namespace,
                    classCount: m.classes.length
                })),
                classification
            });
        })().catch(error => {
            console.error('개념 추출 중 오류:', error);
            res.status(500).json({ error: '개념 정보 추출 중 오류가 발생했습니다.' });
        });
    }
    catch (error) {
        console.error('개념 추출 중 오류:', error);
        res.status(500).json({ error: '개념 정보 추출 중 오류가 발생했습니다.' });
    }
});
// 객체 추출 API
app.get('/api/objects', (req, res) => {
    try {
        // 비동기 함수를 즉시 실행 함수로 래핑하여 사용
        (async () => {
            // 먼저 개념 모델 로드
            const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
            const conceptModel = await conceptExtractor.extractAllModules();
            // 객체 추출기 초기화
            const objectExtractor = new ObjectExtractor(XSD_BASE_PATH);
            objectExtractor.setConceptualModel(conceptModel);
            // 객체 정보 추출
            const cityObjects = objectExtractor.extractAllCityObjects();
            const objectsByModule = objectExtractor.classifyObjectsByModule();
            res.json({
                objectCount: cityObjects.size,
                objectsByModule,
                // 샘플 객체 정보
                sampleObjects: Array.from(cityObjects.entries())
                    .slice(0, 5)
                    .map(([name, obj]) => ({
                    name,
                    module: obj.module,
                    isAbstract: obj.isAbstract,
                    geometryPropertiesCount: obj.geometryProperties?.length || 0,
                    maxLod: obj.lodInfo?.maxLod || 0
                }))
            });
        })().catch(error => {
            console.error('객체 추출 중 오류:', error);
            res.status(500).json({ error: '객체 정보 추출 중 오류가 발생했습니다.' });
        });
    }
    catch (error) {
        console.error('객체 추출 중 오류:', error);
        res.status(500).json({ error: '객체 정보 추출 중 오류가 발생했습니다.' });
    }
});
// 속성 추출 API
app.get('/api/attributes', (req, res) => {
    try {
        // 비동기 함수를 즉시 실행 함수로 래핑하여 사용
        (async () => {
            // 먼저 개념 모델 로드
            const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
            const conceptModel = await conceptExtractor.extractAllModules();
            // 속성 추출기 초기화
            const attributeExtractor = new AttributeExtractor(XSD_BASE_PATH);
            attributeExtractor.setConceptualModel(conceptModel);
            // 코드 리스트 및 열거형 추출
            const codelists = attributeExtractor.extractAllCodelists();
            const enumerations = attributeExtractor.extractAllEnumerations();
            // 카디널리티 분석
            const cardinalitySummary = attributeExtractor.analyzeCardinality();
            res.json({
                codelistCount: codelists.length,
                enumerationCount: enumerations.length,
                requiredAttributesCount: cardinalitySummary.requiredAttributes.length,
                optionalAttributesCount: cardinalitySummary.optionalAttributes.length,
                multiValuedAttributesCount: cardinalitySummary.multiValuedAttributes.length,
                // 샘플 코드리스트
                sampleCodelists: codelists.slice(0, 3).map(cl => ({
                    name: cl.name,
                    valueCount: cl.values.length,
                    sampleValues: cl.values.slice(0, 3).map(v => v.code)
                }))
            });
        })().catch(error => {
            console.error('속성 추출 중 오류:', error);
            res.status(500).json({ error: '속성 정보 추출 중 오류가 발생했습니다.' });
        });
    }
    catch (error) {
        console.error('속성 추출 중 오류:', error);
        res.status(500).json({ error: '속성 정보 추출 중 오류가 발생했습니다.' });
    }
});
// 관계 추출 API
app.get('/api/relationships', (req, res) => {
    try {
        // 비동기 함수를 즉시 실행 함수로 래핑하여 사용
        (async () => {
            // 먼저 개념 모델 로드
            const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
            const conceptModel = await conceptExtractor.extractAllModules();
            // 관계 추출기 초기화
            const relationshipExtractor = new RelationshipExtractor();
            relationshipExtractor.setXsdBasePath(XSD_BASE_PATH);
            relationshipExtractor.setConceptualModel(conceptModel);
            // XSD 파일 경로 목록 생성
            const xsdFilePaths = conceptModel.modules.map(m => path.join(XSD_BASE_PATH, `${m.name}.xsd`));
            // 관계 추출 (선택 사항)
            await relationshipExtractor.extractRelationships(xsdFilePaths);
            // 모듈 간 관계 추출
            const moduleRelationships = relationshipExtractor.extractModuleRelationships();
            // 관계 다중성 분석
            const multiplicitySummary = relationshipExtractor.analyzeRelationshipMultiplicity();
            res.json({
                moduleDependenciesCount: moduleRelationships.dependencies.length,
                crossModuleAssociationsCount: moduleRelationships.crossModuleAssociations.length,
                oneToOneCount: multiplicitySummary.oneToOne.length,
                oneToManyCount: multiplicitySummary.oneToMany.length,
                // 샘플 모듈 의존성
                sampleDependencies: moduleRelationships.dependencies.slice(0, 5)
            });
        })().catch(error => {
            console.error('관계 추출 중 오류:', error);
            res.status(500).json({ error: '관계 정보 추출 중 오류가 발생했습니다.' });
        });
    }
    catch (error) {
        console.error('관계 추출 중 오류:', error);
        res.status(500).json({ error: '관계 정보 추출 중 오류가 발생했습니다.' });
    }
});
// 특정 모듈 정보 API
app.get('/api/modules/:moduleName', (req, res) => {
    try {
        // 비동기 함수를 즉시 실행 함수로 래핑하여 사용
        (async () => {
            const { moduleName } = req.params;
            // 개념 모델 로드
            const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
            const conceptModel = await conceptExtractor.extractAllModules();
            // 모듈 찾기
            const module = conceptModel.modules.find(m => m.name === moduleName);
            if (!module) {
                return res.status(404).json({ error: `${moduleName} 모듈을 찾을 수 없습니다.` });
            }
            // 관계 추출기 초기화 (관계 그래프 생성용)
            const relationshipExtractor = new RelationshipExtractor();
            relationshipExtractor.setConceptualModel(conceptModel);
            // 모듈 관계 그래프 생성
            const graph = relationshipExtractor.createModuleRelationshipGraph(moduleName);
            res.json({
                name: module.name,
                namespace: module.namespace,
                description: module.description,
                classCount: module.classes.length,
                codelistCount: module.codelists?.length || 0,
                enumerationCount: module.enumerations?.length || 0,
                dependencies: module.dependencies || [],
                relationshipGraph: graph
            });
        })().catch(error => {
            console.error(`모듈 정보 추출 중 오류:`, error);
            res.status(500).json({ error: '모듈 정보 추출 중 오류가 발생했습니다.' });
        });
    }
    catch (error) {
        console.error(`모듈 정보 추출 중 오류:`, error);
        res.status(500).json({ error: '모듈 정보 추출 중 오류가 발생했습니다.' });
    }
});
// MCP 서버 설정
// const mcpServer = createServer({
//   resources: {
//     // 리소스 구현
//     concepts: async () => {
//       const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
//       const conceptModel = await conceptExtractor.extractAllModules();
//       
//       // 분류 체계 데이터 생성
//       const classification: Record<string, string[]> = {};
//       
//       // 모듈별로 클래스 분류
//       for (const module of conceptModel.modules) {
//         classification[module.name] = module.classes.map(c => c.name);
//       }
//       
//       return {
//         version: conceptModel.version,
//         moduleCount: conceptModel.modules.length,
//         modules: conceptModel.modules.map(m => ({ 
//           name: m.name,
//           namespace: m.namespace,
//           classCount: m.classes.length
//         })),
//         classification
//       };
//     },
//     objects: async () => {
//       const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
//       const conceptModel = await conceptExtractor.extractAllModules();
//       
//       const objectExtractor = new ObjectExtractor(XSD_BASE_PATH);
//       objectExtractor.setConceptualModel(conceptModel);
//       
//       const cityObjects = objectExtractor.extractAllCityObjects();
//       const objectsByModule = objectExtractor.classifyObjectsByModule();
//       
//       return {
//         objectCount: cityObjects.size,
//         objectsByModule,
//         sampleObjects: Array.from(cityObjects.entries())
//           .slice(0, 5)
//           .map(([name, obj]) => ({
//             name,
//             module: obj.module,
//             isAbstract: obj.isAbstract,
//             geometryPropertiesCount: obj.geometryProperties?.length || 0,
//             maxLod: obj.lodInfo?.maxLod || 0
//           }))
//       };
//     },
//     // 다른 리소스들도 유사하게 구현
//   },
//   tools: {
//     // 도구 구현
//     search_concepts: async ({ query, module }: { query: string; module?: string }) => {
//       const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
//       const conceptModel = await conceptExtractor.extractAllModules();
//       
//       // 검색 기능 구현
//       const searchResults = conceptModel.modules
//         .flatMap(mod => {
//           if (module && mod.name !== module) return [];
//           
//           // 클래스, 코드리스트, 열거형에서 검색
//           const classes = mod.classes.filter(c => 
//             c.name.toLowerCase().includes(query.toLowerCase()) || 
//             c.description.toLowerCase().includes(query.toLowerCase())
//           );
//           
//           const codelists = (mod.codelists || []).filter(cl => 
//             cl.name.toLowerCase().includes(query.toLowerCase()) || 
//             cl.description.toLowerCase().includes(query.toLowerCase())
//           );
//           
//           const enumerations = (mod.enumerations || []).filter(en => 
//             en.name.toLowerCase().includes(query.toLowerCase()) || 
//             en.description.toLowerCase().includes(query.toLowerCase())
//           );
//           
//           return [
//             ...classes.map(c => ({ type: 'class', moduleId: mod.name, ...c })),
//             ...codelists.map(cl => ({ type: 'codelist', moduleId: mod.name, ...cl })),
//             ...enumerations.map(en => ({ type: 'enumeration', moduleId: mod.name, ...en }))
//           ];
//         });
//       
//       return searchResults;
//     },
//     
//     extract_object_hierarchy: async ({ objectName }: { objectName: string }) => {
//       const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
//       const conceptModel = await conceptExtractor.extractAllModules();
//       
//       // 찾고자 하는 객체 식별
//       let targetClass = null;
//       let targetModule = null;
//       
//       // 모든 모듈에서 클래스 찾기
//       for (const module of conceptModel.modules) {
//         const foundClass = module.classes.find(c => c.name === objectName);
//         if (foundClass) {
//           targetClass = foundClass;
//           targetModule = module;
//           break;
//         }
//       }
//       
//       if (!targetClass || !targetModule) {
//         throw new Error(`객체 ${objectName}을(를) 찾을 수 없습니다.`);
//       }
//       
//       // 계층 구조 구축
//       const hierarchyData: {
//         name: string;
//         module: string;
//         isAbstract: boolean;
//         superClasses: string[];
//         subClasses: Array<{name: string; module: string}>;
//       } = {
//         name: targetClass.name,
//         module: targetModule.name,
//         isAbstract: targetClass.isAbstract || false,
//         superClasses: targetClass.superClasses || [],
//         subClasses: []
//       };
//       
//       // 하위 클래스 찾기
//       for (const module of conceptModel.modules) {
//         for (const classInfo of module.classes) {
//           if (classInfo.superClasses && classInfo.superClasses.includes(targetClass.name)) {
//             hierarchyData.subClasses.push({
//               name: classInfo.name,
//               module: module.name
//             });
//           }
//         }
//       }
//       
//       return hierarchyData;
//     },
//     
//     // 다른 도구들도 유사하게 구현
//   },
//   
//   prompts: {
//     citygml_concept_explanation: async ({ concept, detail_level = "intermediate" }: { concept: string; detail_level?: "basic" | "intermediate" | "advanced" }) => {
//       const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
//       const conceptModel = await conceptExtractor.extractAllModules();
//       
//       // 개념 찾기
//       let found = false;
//       let conceptInfo: any = null;
//       let conceptType = '';
//       let moduleName = '';
//       
//       // 모든 모듈에서 검색
//       for (const module of conceptModel.modules) {
//         // 클래스 검색
//         const foundClass = module.classes.find(c => c.name === concept);
//         if (foundClass) {
//           conceptInfo = foundClass;
//           conceptType = 'class';
//           moduleName = module.name;
//           found = true;
//           break;
//         }
//         
//         // 코드리스트 검색
//         if (module.codelists) {
//           const foundCodelist = module.codelists.find(cl => cl.name === concept);
//           if (foundCodelist) {
//             conceptInfo = foundCodelist;
//             conceptType = 'codelist';
//             moduleName = module.name;
//             found = true;
//             break;
//           }
//         }
//         
//         // 열거형 검색
//         if (module.enumerations) {
//           const foundEnum = module.enumerations.find(en => en.name === concept);
//           if (foundEnum) {
//             conceptInfo = foundEnum;
//             conceptType = 'enumeration';
//             moduleName = module.name;
//             found = true;
//             break;
//           }
//         }
//       }
//       
//       if (!found || !conceptInfo) {
//         return `CityGML에서 "${concept}" 개념을 찾을 수 없습니다.`;
//       }
//       
//       // 상세도에 따른 설명 생성
//       let explanationText = '';
//       
//       if (detail_level === 'basic') {
//         explanationText = `${concept}은(는) CityGML의 ${moduleName} 모듈에 있는 ${conceptType}입니다. ${conceptInfo.description || '설명이 없습니다.'}`;
//       } 
//       else if (detail_level === 'intermediate') {
//         // 중간 수준의 상세도
//         explanationText = `${concept}은(는) CityGML의 ${moduleName} 모듈에 있는 ${conceptType}입니다.\n\n`;
//         explanationText += `${conceptInfo.description || '설명이 없습니다.'}\n\n`;
//         
//         if (conceptType === 'class') {
//           explanationText += '주요 속성:\n';
//           if (conceptInfo.attributes) {
//             for (const attr of conceptInfo.attributes.slice(0, 5)) {
//               explanationText += `- ${attr.name}: ${attr.type} (${attr.cardinality})\n`;
//             }
//           }
//           
//           if (conceptInfo.superClasses && conceptInfo.superClasses.length > 0) {
//             explanationText += `\n상위 클래스: ${conceptInfo.superClasses.join(', ')}\n`;
//           }
//         } 
//         else if (conceptType === 'codelist' || conceptType === 'enumeration') {
//           explanationText += '값 목록:\n';
//           if (conceptInfo.values) {
//             const values = conceptInfo.values.slice(0, 5);
//             for (const val of values) {
//               if (conceptType === 'codelist') {
//                 explanationText += `- ${val.code}\n`;
//               } else {
//                 explanationText += `- ${val.name}\n`;
//               }
//             }
//             
//             if (conceptInfo.values.length > 5) {
//               explanationText += `\n... 외 ${conceptInfo.values.length - 5}개 더 있음\n`;
//             }
//           }
//         }
//       } 
//       else {
//         // 고급 수준의 상세도 (advanced)
//         // 여기에 더 상세한 정보 추가
//         // 생략...
//       }
//       
//       return explanationText;
//     },
//     // 다른 프롬프트들도 유사하게 구현
//   }
// });
// 서버 시작
app.listen(PORT, () => {
    console.log(`CityGML MCP REST API 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`XSD 파일 경로: ${XSD_BASE_PATH}`);
    // XSD 디렉토리 확인
    if (!fs.existsSync(XSD_BASE_PATH)) {
        console.error(`오류: XSD 디렉토리가 존재하지 않습니다. 경로: ${XSD_BASE_PATH}`);
        process.exit(1);
    }
    const xsdFiles = fs.readdirSync(XSD_BASE_PATH).filter(file => file.endsWith('.xsd'));
    console.log(`XSD 파일 ${xsdFiles.length}개 발견`);
});
// STDIO와 WebSocket 전송 계층 시작 (임시 주석 처리)
// mcpServer.start();
