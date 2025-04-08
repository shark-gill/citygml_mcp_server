/**
 * CityGML MCP 컨텍스트 빌더
 * 추출된 정보를 바탕으로 구조화된 MCP 컨텍스트를 구축합니다.
 */

import {
  ConceptModelDocument,
  ConceptualModel,
  Module,
  Class,
  Attribute,
  Association
} from '../types/conceptModel.js';
import {
  EncodingDocument,
  EncodingRule,
  Example
} from '../types/encoding.js';
import {
  SchemaRegistry,
  SchemaDocument,
  SchemaElement,
  SchemaComplexType
} from '../types/schema.js';

/**
 * 컨텍스트 항목 타입
 */
export enum ContextItemType {
  MODULE = 'module',
  CLASS = 'class',
  ATTRIBUTE = 'attribute',
  ASSOCIATION = 'association',
  EXAMPLE = 'example',
  SCHEMA = 'schema',
  ELEMENT = 'element',
  TYPE = 'type',
  ENCODING_RULE = 'encoding_rule'
}

/**
 * 컨텍스트 항목 인터페이스
 */
export interface ContextItem {
  type: ContextItemType;
  id: string;
  name: string;
  description?: string;
  importance: number;  // 중요도 (0-10)
  relevance: number;   // 관련성 (0-1)
  content: any;
  relatedItems: string[];  // 관련 항목 ID (항상 배열로 초기화)
}

/**
 * 컨텍스트 객체 인터페이스
 */
export interface Context {
  id: string;
  query?: string;
  timestamp: number;
  items: ContextItem[];
  metadata: {
    totalItems: number;
    sources: string[];
    summary?: string;
  };
}

/**
 * 컨텍스트 빌더 클래스
 */
export class ContextBuilder {
  private context: Context;
  private conceptModel?: ConceptModelDocument;
  private encodingDoc?: EncodingDocument;
  private schemaRegistry?: SchemaRegistry;
  
  /**
   * 컨텍스트 빌더 생성자
   */
  constructor(contextId: string = `ctx_${Date.now()}`) {
    // 새 컨텍스트 초기화
    this.context = {
      id: contextId,
      timestamp: Date.now(),
      items: [],
      metadata: {
        totalItems: 0,
        sources: []
      }
    };
  }
  
  /**
   * 컨셉 모델 문서 설정
   * @param doc 컨셉 모델 문서
   */
  setConceptModel(doc: ConceptModelDocument): ContextBuilder {
    this.conceptModel = doc;
    if (!this.context.metadata.sources.includes('concept_model')) {
      this.context.metadata.sources.push('concept_model');
    }
    return this;
  }
  
  /**
   * 인코딩 문서 설정
   * @param doc 인코딩 문서
   */
  setEncodingDocument(doc: EncodingDocument): ContextBuilder {
    this.encodingDoc = doc;
    if (!this.context.metadata.sources.includes('encoding')) {
      this.context.metadata.sources.push('encoding');
    }
    return this;
  }
  
  /**
   * 스키마 레지스트리 설정
   * @param registry 스키마 레지스트리
   */
  setSchemaRegistry(registry: SchemaRegistry): ContextBuilder {
    this.schemaRegistry = registry;
    if (!this.context.metadata.sources.includes('schema')) {
      this.context.metadata.sources.push('schema');
    }
    return this;
  }
  
  /**
   * 쿼리 설정
   * @param query 검색 쿼리
   */
  setQuery(query: string): ContextBuilder {
    this.context.query = query;
    return this;
  }
  
  /**
   * 쿼리 분석 및 관련 정보 식별
   * @param threshold 관련성 임계값 (0-1)
   */
  analyzeQuery(threshold: number = 0.5): ContextBuilder {
    if (!this.context.query) {
      return this;
    }
    
    const query = this.context.query.toLowerCase();
    
    // 모듈, 클래스, 속성 관련 정보 검색
    if (this.conceptModel) {
      this.analyzeConceptModel(query, threshold);
    }
    
    // 인코딩 관련 정보 검색
    if (this.encodingDoc) {
      this.analyzeEncodingDoc(query, threshold);
    }
    
    // 스키마 관련 정보 검색
    if (this.schemaRegistry) {
      this.analyzeSchemaRegistry(query, threshold);
    }
    
    // 컨텍스트 항목 재정렬 (중요도 및 관련성 기준)
    this.optimizeContext();
    
    return this;
  }
  
  /**
   * 컨셉 모델 분석
   * @param query 검색 쿼리
   * @param threshold 관련성 임계값
   */
  private analyzeConceptModel(query: string, threshold: number): void {
    if (!this.conceptModel) return;
    
    const modules = this.conceptModel.model.modules;
    
    // 모듈 분석
    for (const module of modules) {
      const moduleNameRelevance = this.calculateRelevance(module.name, query);
      const moduleDescRelevance = module.description ? 
        this.calculateRelevance(module.description, query) : 0;
      
      const relevance = Math.max(moduleNameRelevance, moduleDescRelevance);
      
      if (relevance >= threshold) {
        this.addModuleToContext(module, relevance);
      }
      
      // 클래스 분석
      for (const cls of module.classes) {
        const classNameRelevance = this.calculateRelevance(cls.name, query);
        const classDescRelevance = cls.description ? 
          this.calculateRelevance(cls.description, query) : 0;
        
        const classRelevance = Math.max(classNameRelevance, classDescRelevance);
        
        if (classRelevance >= threshold) {
          this.addClassToContext(cls, module, classRelevance);
        }
        
        // 속성 분석
        for (const attr of cls.attributes) {
          const attrNameRelevance = this.calculateRelevance(attr.name, query);
          const attrTypeRelevance = attr.type ? 
            this.calculateRelevance(attr.type, query) : 0;
          
          const attrRelevance = Math.max(attrNameRelevance, attrTypeRelevance);
          
          if (attrRelevance >= threshold) {
            this.addAttributeToContext(attr, cls, module, attrRelevance);
          }
        }
        
        // 관계 분석
        if (cls.associations) {
          for (const assoc of cls.associations) {
            const assocNameRelevance = this.calculateRelevance(assoc.name, query);
            const assocTargetRelevance = this.calculateRelevance(assoc.target, query);
            
            const assocRelevance = Math.max(assocNameRelevance, assocTargetRelevance);
            
            if (assocRelevance >= threshold) {
              this.addAssociationToContext(assoc, cls, module, assocRelevance);
            }
          }
        }
      }
    }
  }
  
  /**
   * 인코딩 문서 분석
   * @param query 검색 쿼리
   * @param threshold 관련성 임계값
   */
  private analyzeEncodingDoc(query: string, threshold: number): void {
    if (!this.encodingDoc) return;
    
    // 인코딩 규칙 분석
    for (const rule of this.encodingDoc.model.encodingRules) {
      const ruleNameRelevance = this.calculateRelevance(rule.name, query);
      const ruleDescRelevance = rule.description ? 
        this.calculateRelevance(rule.description, query) : 0;
      
      const relevance = Math.max(ruleNameRelevance, ruleDescRelevance);
      
      if (relevance >= threshold) {
        this.addRuleToContext(rule, relevance);
      }
    }
    
    // 예제 분석
    if (this.encodingDoc.model.examples) {
      for (const example of this.encodingDoc.model.examples) {
        const exampleTitleRelevance = example.title ? 
          this.calculateRelevance(example.title, query) : 0;
        const exampleDescRelevance = example.description ? 
          this.calculateRelevance(example.description, query) : 0;
        
        const relevance = Math.max(exampleTitleRelevance, exampleDescRelevance);
        
        if (relevance >= threshold) {
          this.addExampleToContext(example, relevance);
        }
      }
    }
  }
  
  /**
   * 스키마 레지스트리 분석
   * @param query 검색 쿼리
   * @param threshold 관련성 임계값
   */
  private analyzeSchemaRegistry(query: string, threshold: number): void {
    if (!this.schemaRegistry) return;
    
    // 요소 분석
    for (const elementName in this.schemaRegistry.elementsByName) {
      const nameRelevance = this.calculateRelevance(elementName, query);
      
      if (nameRelevance >= threshold) {
        const elements = this.schemaRegistry.elementsByName[elementName];
        
        for (const element of elements) {
          const docRelevance = element.documentation ? 
            this.calculateRelevance(element.documentation, query) : 0;
          
          const relevance = Math.max(nameRelevance, docRelevance);
          
          if (relevance >= threshold) {
            this.addElementToContext(element, elementName, relevance);
          }
        }
      }
    }
    
    // 타입 분석
    for (const typeName in this.schemaRegistry.typesByName) {
      const nameRelevance = this.calculateRelevance(typeName, query);
      
      if (nameRelevance >= threshold) {
        const types = this.schemaRegistry.typesByName[typeName];
        
        for (const type of types) {
          const docRelevance = type.documentation ? 
            this.calculateRelevance(type.documentation, query) : 0;
          
          const relevance = Math.max(nameRelevance, docRelevance);
          
          if (relevance >= threshold) {
            this.addTypeToContext(type, typeName, relevance);
          }
        }
      }
    }
  }
  
  /**
   * 모듈을 컨텍스트에 추가
   * @param module 모듈
   * @param relevance 관련성 점수
   */
  private addModuleToContext(module: Module, relevance: number): void {
    const moduleId = `module_${module.name.toLowerCase()}`;
    
    // 이미 추가된 항목인지 확인
    if (this.context.items.some(item => item.id === moduleId)) {
      return;
    }
    
    const moduleItem: ContextItem = {
      type: ContextItemType.MODULE,
      id: moduleId,
      name: module.name,
      description: module.description,
      importance: 8,  // 모듈의 기본 중요도
      relevance,
      content: {
        ...module,
        classes: module.classes.map(cls => cls.name)  // 클래스 이름만 포함
      },
      relatedItems: []
    };
    
    this.context.items.push(moduleItem);
    this.context.metadata.totalItems++;
  }
  
  /**
   * 클래스를 컨텍스트에 추가
   * @param cls 클래스
   * @param module 모듈
   * @param relevance 관련성 점수
   */
  private addClassToContext(cls: Class, module: Module, relevance: number): void {
    const classId = `class_${cls.name.toLowerCase()}`;
    const moduleId = `module_${module.name.toLowerCase()}`;
    
    // 이미 추가된 항목인지 확인
    if (this.context.items.some(item => item.id === classId)) {
      return;
    }
    
    const classItem: ContextItem = {
      type: ContextItemType.CLASS,
      id: classId,
      name: cls.name,
      description: cls.description,
      importance: 7,  // 클래스의 기본 중요도
      relevance,
      content: {
        ...cls,
        module: module.name,
        attributes: cls.attributes.map(attr => attr.name),  // 속성 이름만 포함
        associations: cls.associations?.map(assoc => assoc.name) || []  // 관계 이름만 포함
      },
      relatedItems: [moduleId]
    };
    
    this.context.items.push(classItem);
    this.context.metadata.totalItems++;
    
    // 모듈 항목에 관련 항목으로 추가
    const moduleItem = this.context.items.find(item => item.id === moduleId);
    if (moduleItem && moduleItem.relatedItems) {
      if (!moduleItem.relatedItems.includes(classId)) {
        moduleItem.relatedItems.push(classId);
      }
    }
  }
  
  /**
   * 속성을 컨텍스트에 추가
   * @param attr 속성
   * @param cls 클래스
   * @param module 모듈
   * @param relevance 관련성 점수
   */
  private addAttributeToContext(attr: Attribute, cls: Class, module: Module, relevance: number): void {
    const attrId = `attribute_${cls.name.toLowerCase()}_${attr.name.toLowerCase()}`;
    const classId = `class_${cls.name.toLowerCase()}`;
    
    // 이미 추가된 항목인지 확인
    if (this.context.items.some(item => item.id === attrId)) {
      return;
    }
    
    const attrItem: ContextItem = {
      type: ContextItemType.ATTRIBUTE,
      id: attrId,
      name: attr.name,
      description: attr.description,
      importance: 5,  // 속성의 기본 중요도
      relevance,
      content: {
        ...attr,
        class: cls.name,
        module: module.name
      },
      relatedItems: [classId]
    };
    
    this.context.items.push(attrItem);
    this.context.metadata.totalItems++;
    
    // 클래스 항목에 관련 항목으로 추가
    const classItem = this.context.items.find(item => item.id === classId);
    if (classItem && classItem.relatedItems) {
      if (!classItem.relatedItems.includes(attrId)) {
        classItem.relatedItems.push(attrId);
      }
    }
  }
  
  /**
   * 관계를 컨텍스트에 추가
   * @param assoc 관계
   * @param cls 클래스
   * @param module 모듈
   * @param relevance 관련성 점수
   */
  private addAssociationToContext(assoc: Association, cls: Class, module: Module, relevance: number): void {
    const assocId = `association_${cls.name.toLowerCase()}_${assoc.name.toLowerCase()}`;
    const classId = `class_${cls.name.toLowerCase()}`;
    const targetClassId = `class_${assoc.target.toLowerCase()}`;
    
    // 이미 추가된 항목인지 확인
    if (this.context.items.some(item => item.id === assocId)) {
      return;
    }
    
    const assocItem: ContextItem = {
      type: ContextItemType.ASSOCIATION,
      id: assocId,
      name: assoc.name,
      description: assoc.description,
      importance: 6,  // 관계의 기본 중요도
      relevance,
      content: {
        ...assoc,
        source: cls.name,
        module: module.name
      },
      relatedItems: [classId, targetClassId]
    };
    
    this.context.items.push(assocItem);
    this.context.metadata.totalItems++;
    
    // 클래스 항목에 관련 항목으로 추가
    const classItem = this.context.items.find(item => item.id === classId);
    if (classItem && classItem.relatedItems) {
      if (!classItem.relatedItems.includes(assocId)) {
        classItem.relatedItems.push(assocId);
      }
    }
  }
  
  /**
   * 인코딩 규칙을 컨텍스트에 추가
   * @param rule 인코딩 규칙
   * @param relevance 관련성
   */
  private addRuleToContext(rule: EncodingRule, relevance: number): void {
    const ruleId = `rule_${rule.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Rule 항목 생성
    const ruleItem: ContextItem = {
      id: ruleId,
      type: ContextItemType.ENCODING_RULE,
      name: rule.name || 'Unnamed Rule',
      description: rule.description,
      importance: 6,
      relevance,
      content: {
        ...rule
      },
      relatedItems: []
    };
    
    // 관련 클래스 항목 연결
    if (rule.appliesTo && rule.appliesTo.length > 0) {
      for (const className of rule.appliesTo) {
        const classId = `class_${className.toLowerCase()}`;
        if (!ruleItem.relatedItems.includes(classId)) {
          ruleItem.relatedItems.push(classId);
        }
      }
    }
    
    this.context.items.push(ruleItem);
  }
  
  /**
   * 예제를 컨텍스트에 추가
   * @param example 예제
   * @param relevance 관련성
   */
  private addExampleToContext(example: Example, relevance: number): void {
    const exampleId = `example_${example.title ? example.title.toLowerCase().replace(/\s+/g, '_') : Date.now()}`;
    
    // Example 항목 생성
    const exampleItem: ContextItem = {
      id: exampleId,
      type: ContextItemType.EXAMPLE,
      name: example.title || 'Unnamed Example',
      importance: 4,
      relevance,
      content: {
        ...example
      },
      relatedItems: []
    };
    
    // 관련 클래스 항목 연결
    if (example.relatedClasses && example.relatedClasses.length > 0) {
      for (const className of example.relatedClasses) {
        const classId = `class_${className.toLowerCase()}`;
        if (!exampleItem.relatedItems.includes(classId)) {
          exampleItem.relatedItems.push(classId);
        }
      }
    }
    
    this.context.items.push(exampleItem);
  }
  
  /**
   * 스키마 요소를 컨텍스트에 추가
   * @param element 스키마 요소
   * @param elementName 요소 이름
   * @param relevance 관련성 점수
   */
  private addElementToContext(element: SchemaElement, elementName: string, relevance: number): void {
    const elementId = `element_${elementName.toLowerCase()}`;
    
    // 이미 추가된 항목인지 확인
    if (this.context.items.some(item => item.id === elementId)) {
      return;
    }
    
    const elementItem: ContextItem = {
      type: ContextItemType.ELEMENT,
      id: elementId,
      name: elementName,
      description: element.documentation,
      importance: 5,
      relevance,
      content: {
        ...element,
        name: elementName
      },
      relatedItems: []
    };
    
    // 타입이 있는 경우 관련 타입 링크
    if (element.type) {
      const typeName = element.type.split(':').pop() || '';
      const typeId = `type_${typeName.toLowerCase()}`;
      if (!elementItem.relatedItems?.includes(typeId)) {
        elementItem.relatedItems?.push(typeId);
      }
    }
    
    this.context.items.push(elementItem);
    this.context.metadata.totalItems++;
  }
  
  /**
   * 스키마 타입을 컨텍스트에 추가
   * @param type 스키마 타입
   * @param typeName 타입 이름
   * @param relevance 관련성 점수
   */
  private addTypeToContext(type: SchemaComplexType | any, typeName: string, relevance: number): void {
    const typeId = `type_${typeName.toLowerCase()}`;
    
    // 이미 추가된 항목인지 확인
    if (this.context.items.some(item => item.id === typeId)) {
      return;
    }
    
    const isComplex = 'abstract' in type;
    
    const typeItem: ContextItem = {
      type: ContextItemType.TYPE,
      id: typeId,
      name: typeName,
      description: type.documentation,
      importance: 5,
      relevance,
      content: {
        ...type,
        name: typeName,
        isComplex
      },
      relatedItems: []
    };
    
    // 베이스 타입이 있는 경우 관련 타입 링크
    if (isComplex && (type as SchemaComplexType).base !== undefined && (type as SchemaComplexType).base) {
      const baseName = ((type as SchemaComplexType).base?.split(':').pop()) || '';
      const baseId = `type_${baseName.toLowerCase()}`;
      typeItem.relatedItems = typeItem.relatedItems || [];
      if (!typeItem.relatedItems.includes(baseId)) {
        typeItem.relatedItems.push(baseId);
      }
    }
    this.context.items.push(typeItem);
    this.context.metadata.totalItems++;
  }
  
  /**
   * 문자열 간의 관련성 계산
   * @param str1 첫 번째 문자열
   * @param str2 두 번째 문자열
   * @returns 관련성 점수 (0-1)
   */
  private calculateRelevance(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // 정확히 일치하는 경우
    if (s1 === s2) {
      return 1.0;
    }
    
    // 포함 관계인 경우
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.8;
    }
    
    // 단어 단위로 분리하여 공통 단어 비율 계산
    const words1 = s1.split(/\W+/).filter(w => w.length > 1);
    const words2 = s2.split(/\W+/).filter(w => w.length > 1);
    
    const commonWords = words1.filter(w => words2.includes(w));
    
    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }
    
    // 자카드 유사도 사용
    return commonWords.length / (words1.length + words2.length - commonWords.length);
  }
  
  /**
   * 컨텍스트 최적화 (중요도 및 관련성 기준으로 정렬)
   */
  private optimizeContext(): void {
    // 중요도와 관련성 점수를 기반으로 항목 정렬
    this.context.items.sort((a, b) => {
      const scoreA = a.importance * 0.5 + a.relevance * 0.5;
      const scoreB = b.importance * 0.5 + b.relevance * 0.5;
      return scoreB - scoreA;
    });
    
    // 컨텍스트 요약 생성
    this.generateSummary();
  }
  
  /**
   * 컨텍스트 요약 생성
   */
  private generateSummary(): void {
    if (this.context.items.length === 0) {
      this.context.metadata.summary = "컨텍스트에 관련 항목이 없습니다.";
      return;
    }
    
    const topItems = this.context.items.slice(0, 5);
    const itemTypes = new Set(topItems.map(item => item.type));
    
    let summary = `이 컨텍스트는 ${this.context.metadata.totalItems}개의 항목을 포함하며, `;
    summary += `주요 항목 유형: ${Array.from(itemTypes).join(', ')}. `;
    
    if (topItems.length > 0) {
      summary += `가장 관련성 높은 항목: ${topItems[0].name}`;
      if (topItems[0].type === ContextItemType.CLASS) {
        summary += ` 클래스`;
      } else if (topItems[0].type === ContextItemType.MODULE) {
        summary += ` 모듈`;
      }
      summary += `.`;
    }
    
    this.context.metadata.summary = summary;
  }
  
  /**
   * 빌드된 컨텍스트 반환
   * @returns 컨텍스트 객체
   */
  build(): Context {
    return this.context;
  }
} 