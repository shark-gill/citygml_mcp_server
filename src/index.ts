import * as path from 'path';
import * as fs from 'fs';
import express from 'express';
import { ConceptExtractor } from './extractors/concepts.js';
import { ObjectExtractor } from './extractors/objects.js';
import { AttributeExtractor } from './extractors/attributes.js';
import { RelationshipExtractor } from './extractors/relationships.js';
import { createServer } from '@mcp/server';

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
    message: 'CityGML MCP 서버',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      { path: '/api/concepts', description: '개념 정보 추출' },
      { path: '/api/objects', description: '객체 정보 추출' },
      { path: '/api/attributes', description: '속성 정보 추출' },
      { path: '/api/relationships', description: '관계 정보 추출' },
      { path: '/api/modules/:moduleName', description: '특정 모듈 정보 조회' },
      { path: '/api/search', description: 'CityGML 개념/객체 검색' }
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
      const classification: Record<string, string[]> = {};
      
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    console.error(`모듈 정보 추출 중 오류:`, error);
    res.status(500).json({ error: '모듈 정보 추출 중 오류가 발생했습니다.' });
  }
});

// 검색 API 추가
app.get('/api/search', (req, res) => {
  try {
    const query = req.query.q as string;
    const moduleFilter = req.query.module as string;
    
    if (!query) {
      return res.status(400).json({ error: '검색어(q)가 필요합니다.' });
    }
    
    // 비동기 함수를 즉시 실행 함수로 래핑하여 사용
    (async () => {
      const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
      const conceptModel = await conceptExtractor.extractAllModules();
      
      // 검색 결과 저장
      const results: any[] = [];
      
      // 모듈별 검색
      for (const module of conceptModel.modules) {
        // 모듈 필터가 지정된 경우 해당 모듈만 검색
        if (moduleFilter && module.name !== moduleFilter) {
          continue;
        }
        
        // 클래스 검색
        const matchingClasses = module.classes.filter(c => 
          c.name.toLowerCase().includes(query.toLowerCase()) || 
          (c.description && c.description.toLowerCase().includes(query.toLowerCase()))
        );
        
        // 코드리스트 검색
        const matchingCodelists = (module.codelists || []).filter(cl => 
          cl.name.toLowerCase().includes(query.toLowerCase()) || 
          (cl.description && cl.description.toLowerCase().includes(query.toLowerCase()))
        );
        
        // 열거형 검색
        const matchingEnumerations = (module.enumerations || []).filter(en => 
          en.name.toLowerCase().includes(query.toLowerCase()) || 
          (en.description && en.description.toLowerCase().includes(query.toLowerCase()))
        );
        
        // 결과 추가
        results.push(
          ...matchingClasses.map(c => ({ type: 'class', module: module.name, ...c })),
          ...matchingCodelists.map(cl => ({ type: 'codelist', module: module.name, ...cl })),
          ...matchingEnumerations.map(en => ({ type: 'enumeration', module: module.name, ...en }))
        );
      }
      
      res.json({
        query,
        moduleFilter: moduleFilter || '전체',
        totalResults: results.length,
        results
      });
    })().catch(error => {
      console.error('검색 중 오류:', error);
      res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
    });
  } catch (error) {
    console.error('검색 중 오류:', error);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

// MCP 서버 설정 - 여기를 강화
const mcpServer = createServer({
  resources: {
    // 개념 리소스
    concepts: async () => {
      const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
      const conceptModel = await conceptExtractor.extractAllModules();
      
      const classification = {};
      for (const module of conceptModel.modules) {
        classification[module.name] = module.classes.map(c => c.name);
      }
      
      return {
        version: conceptModel.version,
        moduleCount: conceptModel.modules.length,
        modules: conceptModel.modules.map(m => ({ 
          name: m.name,
          namespace: m.namespace,
          classCount: m.classes.length
        })),
        classification
      };
    },
    
    // 객체 리소스
    objects: async () => {
      const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
      const conceptModel = await conceptExtractor.extractAllModules();
      
      const objectExtractor = new ObjectExtractor(XSD_BASE_PATH);
      objectExtractor.setConceptualModel(conceptModel);
      
      const cityObjects = objectExtractor.extractAllCityObjects();
      const objectsByModule = objectExtractor.classifyObjectsByModule();
      
      return {
        objectCount: cityObjects.size,
        objectsByModule,
        sampleObjects: Array.from(cityObjects.entries())
          .slice(0, 5)
          .map(([name, obj]) => ({
            name,
            module: obj.module,
            isAbstract: obj.isAbstract,
            geometryPropertiesCount: obj.geometryProperties?.length || 0,
            maxLod: obj.lodInfo?.maxLod || 0
          }))
      };
    },
    
    // 속성 리소스
    attributes: async () => {
      const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
      const conceptModel = await conceptExtractor.extractAllModules();
      
      const attributeExtractor = new AttributeExtractor(XSD_BASE_PATH);
      attributeExtractor.setConceptualModel(conceptModel);
      
      const codelists = attributeExtractor.extractAllCodelists();
      const enumerations = attributeExtractor.extractAllEnumerations();
      const cardinalitySummary = attributeExtractor.analyzeCardinality();
      
      return {
        codelistCount: codelists.length,
        enumerationCount: enumerations.length,
        attributeStats: {
          required: cardinalitySummary.requiredAttributes.length,
          optional: cardinalitySummary.optionalAttributes.length,
          multiValued: cardinalitySummary.multiValuedAttributes.length
        },
        sampleCodelists: codelists.slice(0, 3)
      };
    },
    
    // 관계 리소스
    relationships: async () => {
      const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
      const conceptModel = await conceptExtractor.extractAllModules();
      
      const relationshipExtractor = new RelationshipExtractor();
      relationshipExtractor.setXsdBasePath(XSD_BASE_PATH);
      relationshipExtractor.setConceptualModel(conceptModel);
      
      const xsdFilePaths = conceptModel.modules.map(m => 
        path.join(XSD_BASE_PATH, `${m.name}.xsd`)
      );
      
      await relationshipExtractor.extractRelationships(xsdFilePaths);
      const moduleRelationships = relationshipExtractor.extractModuleRelationships();
      const multiplicitySummary = relationshipExtractor.analyzeRelationshipMultiplicity();
      
      return {
        moduleRelationships,
        multiplicitySummary
      };
    }
  },
  
  tools: {
    // 개념 검색 도구
    search_citygml: async ({ query, module, type }: { query: string; module?: string; type?: string }) => {
      const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
      const conceptModel = await conceptExtractor.extractAllModules();
      
      // 검색 결과 저장
      const results = [];
      
      // 모듈별 검색
      for (const m of conceptModel.modules) {
        // 모듈 필터가 지정된 경우 해당 모듈만 검색
        if (module && m.name !== module) {
          continue;
        }
        
        // 타입별 검색
        if (!type || type === 'class') {
          const matchingClasses = m.classes.filter(c => 
            c.name.toLowerCase().includes(query.toLowerCase()) || 
            (c.description && c.description.toLowerCase().includes(query.toLowerCase()))
          );
          results.push(...matchingClasses.map(c => ({ type: 'class', module: m.name, ...c })));
        }
        
        if (!type || type === 'codelist') {
          const matchingCodelists = (m.codelists || []).filter(cl => 
            cl.name.toLowerCase().includes(query.toLowerCase()) || 
            (cl.description && cl.description.toLowerCase().includes(query.toLowerCase()))
          );
          results.push(...matchingCodelists.map(cl => ({ type: 'codelist', module: m.name, ...cl })));
        }
        
        if (!type || type === 'enumeration') {
          const matchingEnumerations = (m.enumerations || []).filter(en => 
            en.name.toLowerCase().includes(query.toLowerCase()) || 
            (en.description && en.description.toLowerCase().includes(query.toLowerCase()))
          );
          results.push(...matchingEnumerations.map(en => ({ type: 'enumeration', module: m.name, ...en })));
        }
      }
      
      return {
        query,
        module: module || 'all',
        type: type || 'all',
        count: results.length,
        results
      };
    },
    
    // 객체 계층 추출 도구
    extract_object_hierarchy: async ({ objectName }: { objectName: string }) => {
      const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
      const conceptModel = await conceptExtractor.extractAllModules();
      
      // 객체 찾기
      let targetClass = null;
      let targetModule = null;
      
      for (const module of conceptModel.modules) {
        const foundClass = module.classes.find(c => c.name === objectName);
        if (foundClass) {
          targetClass = foundClass;
          targetModule = module;
          break;
        }
      }
      
      if (!targetClass || !targetModule) {
        throw new Error(`객체 ${objectName}을(를) 찾을 수 없습니다.`);
      }
      
      // 계층 구조 구축
      const hierarchy = {
        name: targetClass.name,
        module: targetModule.name,
        isAbstract: targetClass.isAbstract || false,
        superClasses: targetClass.superClasses || [],
        subClasses: []
      };
      
      // 하위 클래스 찾기
      for (const module of conceptModel.modules) {
        for (const cls of module.classes) {
          if (cls.superClasses && cls.superClasses.includes(targetClass.name)) {
            hierarchy.subClasses.push({
              name: cls.name,
              module: module.name
            });
          }
        }
      }
      
      return hierarchy;
    },
    
    // LOD 정보 추출 도구
    analyze_lod_capabilities: async ({ objectName }: { objectName: string }) => {
      const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
      const conceptModel = await conceptExtractor.extractAllModules();
      
      const objectExtractor = new ObjectExtractor(XSD_BASE_PATH);
      objectExtractor.setConceptualModel(conceptModel);
      
      const cityObjects = objectExtractor.extractAllCityObjects();
      const cityObject = cityObjects.get(objectName);
      
      if (!cityObject) {
        throw new Error(`객체 ${objectName}을(를) 찾을 수 없습니다.`);
      }
      
      return {
        name: objectName,
        module: cityObject.module,
        lodInfo: cityObject.lodInfo,
        geometryProperties: cityObject.geometryProperties
      };
    }
  },
  
  prompts: {
    // CityGML 개념 설명 프롬프트
    citygml_concept_explanation: async ({ concept, detail_level = "intermediate" }: { concept: string; detail_level?: "basic" | "intermediate" | "advanced" }) => {
      const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
      const conceptModel = await conceptExtractor.extractAllModules();
      
      // 개념 찾기
      let found = false;
      let conceptInfo = null;
      let conceptType = '';
      let moduleName = '';
      
      // 모든 모듈에서 검색
      for (const module of conceptModel.modules) {
        // 클래스 검색
        const foundClass = module.classes.find(c => c.name === concept);
        if (foundClass) {
          conceptInfo = foundClass;
          conceptType = 'class';
          moduleName = module.name;
          found = true;
          break;
        }
        
        // 코드리스트 검색
        if (module.codelists) {
          const foundCodelist = module.codelists.find(cl => cl.name === concept);
          if (foundCodelist) {
            conceptInfo = foundCodelist;
            conceptType = 'codelist';
            moduleName = module.name;
            found = true;
            break;
          }
        }
        
        // 열거형 검색
        if (module.enumerations) {
          const foundEnum = module.enumerations.find(en => en.name === concept);
          if (foundEnum) {
            conceptInfo = foundEnum;
            conceptType = 'enumeration';
            moduleName = module.name;
            found = true;
            break;
          }
        }
      }
      
      if (!found || !conceptInfo) {
        return `CityGML에서 "${concept}" 개념을 찾을 수 없습니다.`;
      }
      
      // 상세도에 따른 설명 생성
      let explanation = '';
      
      if (detail_level === 'basic') {
        explanation = `${concept}은(는) CityGML의 ${moduleName} 모듈에 있는 ${conceptType}입니다. ${conceptInfo.description || ''}`;
      } 
      else if (detail_level === 'intermediate') {
        explanation = `${concept}은(는) CityGML의 ${moduleName} 모듈에 있는 ${conceptType}입니다.\n\n`;
        explanation += `${conceptInfo.description || ''}\n\n`;
        
        if (conceptType === 'class') {
          explanation += '주요 속성:\n';
          if (conceptInfo.attributes) {
            for (const attr of conceptInfo.attributes.slice(0, 5)) {
              explanation += `- ${attr.name}: ${attr.type} (${attr.cardinality})\n`;
            }
            
            if (conceptInfo.attributes.length > 5) {
              explanation += `\n... 외 ${conceptInfo.attributes.length - 5}개 속성\n`;
            }
          }
          
          if (conceptInfo.superClasses && conceptInfo.superClasses.length > 0) {
            explanation += `\n상위 클래스: ${conceptInfo.superClasses.join(', ')}\n`;
          }
        } 
        else if (conceptType === 'codelist' || conceptType === 'enumeration') {
          explanation += '값 목록:\n';
          if (conceptInfo.values) {
            const values = conceptInfo.values.slice(0, 5);
            for (const val of values) {
              if (conceptType === 'codelist') {
                explanation += `- ${val.code}\n`;
              } else {
                explanation += `- ${val.name}\n`;
              }
            }
            
            if (conceptInfo.values.length > 5) {
              explanation += `\n... 외 ${conceptInfo.values.length - 5}개 값\n`;
            }
          }
        }
      } 
      else { // advanced
        // 더 상세한 내용 추가
        explanation = `${concept}은(는) CityGML의 ${moduleName} 모듈에 있는 ${conceptType}입니다.\n\n`;
        explanation += `${conceptInfo.description || ''}\n\n`;
        
        if (conceptType === 'class') {
          explanation += '전체 속성 목록:\n';
          if (conceptInfo.attributes) {
            for (const attr of conceptInfo.attributes) {
              explanation += `- ${attr.name}: ${attr.type} (${attr.cardinality})\n`;
              if (attr.description) {
                explanation += `  설명: ${attr.description}\n`;
              }
            }
          }
          
          explanation += '\n상속 계층:\n';
          if (conceptInfo.superClasses && conceptInfo.superClasses.length > 0) {
            explanation += `- 상위 클래스: ${conceptInfo.superClasses.join(', ')}\n`;
          } else {
            explanation += '- 상위 클래스 없음\n';
          }
          
          // 하위 클래스 찾기
          const subClasses = [];
          for (const module of conceptModel.modules) {
            for (const cls of module.classes) {
              if (cls.superClasses && cls.superClasses.includes(concept)) {
                subClasses.push(`${cls.name} (${module.name} 모듈)`);
              }
            }
          }
          
          if (subClasses.length > 0) {
            explanation += `- 하위 클래스: ${subClasses.join(', ')}\n`;
          } else {
            explanation += '- 하위 클래스 없음\n';
          }
          
          explanation += '\n관계:\n';
          if (conceptInfo.associations) {
            for (const assoc of conceptInfo.associations) {
              explanation += `- ${assoc.name} -> ${assoc.target} (${assoc.cardinality})\n`;
            }
          } else {
            explanation += '- 관계 정보 없음\n';
          }
        } 
        else if (conceptType === 'codelist' || conceptType === 'enumeration') {
          explanation += '전체 값 목록:\n';
          if (conceptInfo.values) {
            for (const val of conceptInfo.values) {
              if (conceptType === 'codelist') {
                explanation += `- ${val.code}\n`;
                if (val.description) {
                  explanation += `  설명: ${val.description}\n`;
                }
              } else {
                explanation += `- ${val.name}\n`;
                if (val.description) {
                  explanation += `  설명: ${val.description}\n`;
                }
              }
            }
          }
        }
      }
      
      return explanation;
    },
    
    // 모듈 설명 프롬프트
    citygml_module_explanation: async ({ moduleName }: { moduleName: string }) => {
      const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
      const conceptModel = await conceptExtractor.extractAllModules();
      
      // 모듈 찾기
      const module = conceptModel.modules.find(m => m.name === moduleName);
      if (!module) {
        return `CityGML에서 "${moduleName}" 모듈을 찾을 수 없습니다.`;
      }
      
      // 모듈 설명 생성
      let explanation = `${moduleName} 모듈은 CityGML의 한 부분으로, `;
      explanation += `${module.description || '해당 모듈에 대한 설명이 없습니다.'}\n\n`;
      
      explanation += `네임스페이스: ${module.namespace}\n`;
      explanation += `클래스 수: ${module.classes.length}\n`;
      
      if (module.codelists) {
        explanation += `코드리스트 수: ${module.codelists.length}\n`;
      }
      
      if (module.enumerations) {
        explanation += `열거형 수: ${module.enumerations.length}\n`;
      }
      
      if (module.dependencies && module.dependencies.length > 0) {
        explanation += `\n의존성: ${module.dependencies.join(', ')}\n`;
      }
      
      explanation += '\n주요 클래스:\n';
      const mainClasses = module.classes
        .filter(c => !c.name.includes('Property') && !c.name.includes('Type'))
        .slice(0, 5);
      
      for (const cls of mainClasses) {
        explanation += `- ${cls.name}: ${cls.description || '설명 없음'}\n`;
      }
      
      return explanation;
    }
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`CityGML MCP 서버가 포트 ${PORT}에서 실행 중입니다.`);
  
  if (fs.existsSync(XSD_BASE_PATH)) {
    const xsdFiles = fs.readdirSync(XSD_BASE_PATH).filter(file => file.endsWith('.xsd'));
    console.log(`XSD 파일 ${xsdFiles.length}개 발견`);
  } else {
    console.error(`오류: XSD 디렉토리가 존재하지 않습니다: ${XSD_BASE_PATH}`);
  }
});

// MCP 서버 시작
mcpServer.start();