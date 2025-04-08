/**
 * CityGML MCP 컨텍스트 템플릿
 * 다양한 사용 사례를 위한 표준 템플릿을 정의합니다.
 */

import { Context, ContextBuilder, ContextItem, ContextItemType } from './builder.js';
import { ContextFormatter, OutputFormat, FormattingOptions } from './formatter.js';
import { ConceptModelDocument } from '../types/conceptModel.js';
import { EncodingDocument } from '../types/encoding.js';
import { SchemaRegistry } from '../types/schema.js';

/**
 * 템플릿 변수 타입
 */
export type TemplateVariable = string | number | boolean | object | null;

/**
 * 템플릿 변수 맵
 */
export type TemplateVariableMap = Record<string, TemplateVariable>;

/**
 * 템플릿 유형 열거형
 */
export enum TemplateType {
  CLASS_DETAIL = 'class_detail',
  MODULE_SUMMARY = 'module_summary',
  CLASS_HIERARCHY = 'class_hierarchy',
  ELEMENT_DETAIL = 'element_detail',
  ENCODING_GUIDE = 'encoding_guide',
  COMPARE_CLASSES = 'compare_classes',
  SCHEMA_MAPPING = 'schema_mapping',
  FEATURE_OVERVIEW = 'feature_overview'
}

/**
 * 템플릿 관련 함수 인터페이스
 */
export interface TemplateHelpers {
  // 문자열 관련 도우미 함수
  capitalize: (str: string) => string;
  truncate: (str: string, maxLength: number) => string;
  
  // 조건부 렌더링 도우미 함수
  ifEquals: (a: any, b: any, ifTrue: string, ifFalse: string) => string;
  ifNotEmpty: (value: any, output: string) => string;
  
  // 반복 렌더링 도우미 함수
  each: (arr: any[], template: string) => string;
  
  // 데이터 변환 도우미 함수
  json: (obj: any) => string;
  markdown: (text: string) => string;
}

/**
 * 템플릿 인터페이스
 */
export interface Template {
  type: TemplateType;
  name: string;
  description: string;
  template: string;
  requiredVariables: string[];
  optionalVariables?: string[];
  formatOptions?: Partial<FormattingOptions>;
}

/**
 * 컨텍스트 템플릿 관리자 클래스
 */
export class TemplateManager {
  private static templates: Map<TemplateType, Template> = new Map();
  
  /**
   * 기본 템플릿 초기화
   */
  static initDefaultTemplates(): void {
    // 기본 템플릿 등록
    this.registerTemplate(classDetailTemplate);
    this.registerTemplate(moduleSummaryTemplate);
    this.registerTemplate(classHierarchyTemplate);
    this.registerTemplate(elementDetailTemplate);
    this.registerTemplate(encodingGuideTemplate);
    this.registerTemplate(compareClassesTemplate);
    this.registerTemplate(schemaMappingTemplate);
    this.registerTemplate(featureOverviewTemplate);
  }
  
  /**
   * 템플릿 등록
   * @param template 템플릿 객체
   */
  static registerTemplate(template: Template): void {
    this.templates.set(template.type, template);
  }
  
  /**
   * 템플릿 가져오기
   * @param type 템플릿 유형
   * @returns 템플릿 객체 또는 undefined
   */
  static getTemplate(type: TemplateType): Template | undefined {
    return this.templates.get(type);
  }
  
  /**
   * 템플릿 적용
   * @param templateType 템플릿 유형
   * @param variables 변수 값
   * @param outputFormat 출력 형식 (기본값: 마크다운)
   * @returns 렌더링된 문자열
   */
  static applyTemplate(
    templateType: TemplateType,
    variables: TemplateVariableMap,
    outputFormat: OutputFormat = OutputFormat.MARKDOWN
  ): string {
    // 템플릿 찾기
    const template = this.getTemplate(templateType);
    if (!template) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${templateType}`);
    }
    
    // 필수 변수 확인
    for (const requiredVar of template.requiredVariables) {
      if (!(requiredVar in variables)) {
        throw new Error(`템플릿 ${templateType}에 필수 변수가 누락되었습니다: ${requiredVar}`);
      }
    }
    
    // 템플릿 문자열 렌더링
    let result = template.template;
    
    // 변수 대체
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result = result.replace(placeholder, String(value));
      } else if (value === null) {
        result = result.replace(placeholder, '');
      } else if (typeof value === 'object') {
        result = result.replace(placeholder, JSON.stringify(value, null, 2));
      }
    }
    
    // 도우미 함수 처리
    result = this.processHelperFunctions(result, variables);
    
    // 조건부 블록 처리
    result = this.processConditionalBlocks(result, variables);
    
    // 템플릿의 포맷 옵션 적용
    const formatOptions: FormattingOptions = {
      format: outputFormat,
      ...template.formatOptions
    };
    
    return result;
  }
  
  /**
   * 컨텍스트에서 템플릿 적용
   * @param context 컨텍스트 객체
   * @param templateType 템플릿 유형
   * @param additionalVars 추가 변수
   * @param outputFormat 출력 형식
   * @returns 렌더링된 문자열
   */
  static applyTemplateToContext(
    context: Context,
    templateType: TemplateType,
    additionalVars: TemplateVariableMap = {},
    outputFormat: OutputFormat = OutputFormat.MARKDOWN
  ): string {
    // 컨텍스트에서 변수 추출
    const contextVars: TemplateVariableMap = {
      context_id: context.id,
      query: context.query || '',
      timestamp: context.timestamp,
      total_items: context.metadata.totalItems,
      sources: context.metadata.sources.join(', '),
      summary: context.metadata.summary || '',
      // 필요한 경우 더 많은 항목 추가
      ...additionalVars
    };
    
    // 첫 번째 항목을 자동으로 추가
    if (context.items.length > 0) {
      const firstItem = context.items[0];
      contextVars.first_item = firstItem;
      contextVars.first_item_name = firstItem.name;
      contextVars.first_item_type = firstItem.type;
      contextVars.first_item_description = firstItem.description || '';
    }
    
    return this.applyTemplate(templateType, contextVars, outputFormat);
  }
  
  /**
   * 데이터 기반으로 템플릿 컨텍스트 생성
   * @param templateType 템플릿 유형
   * @param conceptModel 개념 모델 문서
   * @param encodingDoc 인코딩 문서
   * @param schemaRegistry 스키마 레지스트리
   * @param params 추가 매개변수
   * @returns 컨텍스트 객체
   */
  static createTemplateContext(
    templateType: TemplateType,
    conceptModel?: ConceptModelDocument,
    encodingDoc?: EncodingDocument,
    schemaRegistry?: SchemaRegistry,
    params: Record<string, string> = {}
  ): Context {
    // 템플릿 유형에 맞는 컨텍스트 빌더 초기화
    const builder = new ContextBuilder(`template_${templateType}_${Date.now()}`);
    
    // 데이터 소스 설정
    if (conceptModel) builder.setConceptModel(conceptModel);
    if (encodingDoc) builder.setEncodingDocument(encodingDoc);
    if (schemaRegistry) builder.setSchemaRegistry(schemaRegistry);
    
    // 템플릿 유형에 따른 컨텍스트 구성
    switch (templateType) {
      case TemplateType.CLASS_DETAIL:
        if (params.className) {
          builder.setQuery(params.className);
          builder.analyzeQuery(0.7); // 관련성 높은 항목 필터링
        }
        break;
        
      case TemplateType.MODULE_SUMMARY:
        if (params.moduleName) {
          builder.setQuery(params.moduleName);
          builder.analyzeQuery(0.6);
        }
        break;
        
      case TemplateType.CLASS_HIERARCHY:
        // 클래스 계층 구조 쿼리 구성 (예: 기본 클래스 + 상속 클래스)
        if (params.rootClass) {
          builder.setQuery(params.rootClass);
          builder.analyzeQuery(0.5);
        }
        break;
        
      case TemplateType.ENCODING_GUIDE:
        if (params.entityName) {
          builder.setQuery(params.entityName);
          builder.analyzeQuery(0.5);
        }
        break;
        
      // 다른 템플릿 유형에 대한 처리 추가
      
      default:
        // 기본 처리: 모든 데이터 수집
        if (params.query) {
          builder.setQuery(params.query);
          builder.analyzeQuery(0.3); // 낮은 관련성 임계값으로 더 많은 항목 포함
        }
    }
    
    // 구축된 컨텍스트 반환
    return builder.build();
  }
  
  /**
   * 도우미 함수 처리
   * @param template 템플릿 문자열
   * @param variables 변수 맵
   * @returns 처리된 문자열
   */
  private static processHelperFunctions(template: string, variables: TemplateVariableMap): string {
    let result = template;
    
    // capitalize 함수
    const capitalizeRegex = /\{\{\s*capitalize\s+([^}]+)\s*\}\}/g;
    result = result.replace(capitalizeRegex, (match, varName) => {
      const value = variables[varName.trim()];
      if (typeof value === 'string') {
        return value.charAt(0).toUpperCase() + value.slice(1);
      }
      return match;
    });
    
    // truncate 함수
    const truncateRegex = /\{\{\s*truncate\s+([^}]+)\s+(\d+)\s*\}\}/g;
    result = result.replace(truncateRegex, (match, varName, length) => {
      const value = variables[varName.trim()];
      if (typeof value === 'string') {
        const maxLength = parseInt(length, 10);
        return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
      }
      return match;
    });
    
    // ifEquals 함수
    const ifEqualsRegex = /\{\{\s*ifEquals\s+([^}]+)\s+([^}]+)\s+([^}]+)\s+([^}]+)\s*\}\}/g;
    result = result.replace(ifEqualsRegex, (match, a, b, ifTrue, ifFalse) => {
      const valueA = variables[a.trim()] || a.trim();
      const valueB = variables[b.trim()] || b.trim();
      return valueA === valueB ? ifTrue.trim() : ifFalse.trim();
    });
    
    return result;
  }
  
  /**
   * 조건부 블록 처리
   * @param template 템플릿 문자열
   * @param variables 변수 맵
   * @returns 처리된 문자열
   */
  private static processConditionalBlocks(template: string, variables: TemplateVariableMap): string {
    let result = template;
    
    // if 블록 처리
    const ifBlockRegex = /\{\{\s*if\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*endif\s*\}\}/g;
    result = result.replace(ifBlockRegex, (match, condition, content) => {
      const condValue = variables[condition.trim()];
      
      if (condValue) {
        return content;
      }
      
      return '';
    });
    
    // if-else 블록 처리
    const ifElseBlockRegex = /\{\{\s*if\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*else\s*\}\}([\s\S]*?)\{\{\s*endif\s*\}\}/g;
    result = result.replace(ifElseBlockRegex, (match, condition, ifContent, elseContent) => {
      const condValue = variables[condition.trim()];
      
      if (condValue) {
        return ifContent;
      } else {
        return elseContent;
      }
    });
    
    // each 블록 처리 (간단한 구현)
    const eachBlockRegex = /\{\{\s*each\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*endeach\s*\}\}/g;
    result = result.replace(eachBlockRegex, (match, arrayName, template) => {
      const array = variables[arrayName.trim()];
      
      if (Array.isArray(array)) {
        return array.map(item => {
          let itemTemplate = template;
          
          // 항목을 위한 간단한 템플릿 변환 (기본 속성만 처리)
          for (const [key, value] of Object.entries(item)) {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              const placeholder = new RegExp(`\\{\\{\\s*item\\.${key}\\s*\\}\\}`, 'g');
              itemTemplate = itemTemplate.replace(placeholder, String(value));
            }
          }
          
          return itemTemplate;
        }).join('');
      }
      
      return '';
    });
    
    return result;
  }
}

// 다양한 템플릿 정의

/**
 * 클래스 상세 정보 템플릿
 */
const classDetailTemplate: Template = {
  type: TemplateType.CLASS_DETAIL,
  name: '클래스 상세 정보',
  description: '클래스의 상세 정보, 속성, 관계 등을 표시하는 템플릿',
  template: `# {{className}} 클래스

## 개요

{{description}}

**모듈**: {{moduleName}}
{{if isAbstract}}**추상 클래스**: 예{{endif}}
{{if superClasses}}**상위 클래스**: {{superClasses}}{{endif}}

## 속성

| 이름 | 타입 | 카디널리티 | 설명 |
|------|------|------------|------|
{{each attributes}}| {{item.name}} | {{item.type}} | {{item.cardinality}} | {{item.description}} |
{{endeach}}

## 관계

| 이름 | 대상 | 카디널리티 | 설명 |
|------|------|------------|------|
{{each associations}}| {{item.name}} | {{item.target}} | {{item.cardinality}} | {{item.description}} |
{{endeach}}

{{if examples}}
## 예제

{{each examples}}
### {{item.title}}

\`\`\`{{item.language}}
{{item.code}}
\`\`\`
{{endeach}}
{{endif}}

{{if encodingRules}}
## 인코딩 규칙

{{each encodingRules}}
### {{item.name}}

{{item.description}}
{{endeach}}
{{endif}}
`,
  requiredVariables: ['className', 'description', 'moduleName'],
  optionalVariables: ['isAbstract', 'superClasses', 'attributes', 'associations', 'examples', 'encodingRules'],
  formatOptions: {
    includeContent: true,
    codeFormatting: true
  }
};

/**
 * 모듈 요약 템플릿
 */
const moduleSummaryTemplate: Template = {
  type: TemplateType.MODULE_SUMMARY,
  name: '모듈 요약',
  description: '모듈 및 포함된 클래스 요약 정보를 표시하는 템플릿',
  template: `# {{moduleName}} 모듈

## 개요

{{description}}

**네임스페이스**: {{namespace}}

## 포함된 클래스

{{each classes}}
### {{item.name}}

{{item.description}}

**속성 수**: {{item.attributeCount}}
**관계 수**: {{item.associationCount}}
{{endeach}}

## 관련 모듈

{{each relatedModules}}
- {{item.name}}: {{item.relationship}}
{{endeach}}
`,
  requiredVariables: ['moduleName', 'description', 'namespace'],
  optionalVariables: ['classes', 'relatedModules']
};

/**
 * 클래스 계층 구조 템플릿
 */
const classHierarchyTemplate: Template = {
  type: TemplateType.CLASS_HIERARCHY,
  name: '클래스 계층 구조',
  description: '클래스 상속 계층 구조를 시각화하는 템플릿',
  template: `# {{rootClass}} 클래스 계층 구조

\`\`\`
{{hierarchyDiagram}}
\`\`\`

## 상위 클래스

{{each superClasses}}
- **{{item.name}}**: {{item.description}}
{{endeach}}

## 하위 클래스

{{each subClasses}}
- **{{item.name}}**: {{item.description}}
{{endeach}}

## 상속된 속성

{{each inheritedAttributes}}
- **{{item.name}}** ({{item.sourceClass}}): {{item.type}} - {{item.description}}
{{endeach}}
`,
  requiredVariables: ['rootClass', 'hierarchyDiagram'],
  optionalVariables: ['superClasses', 'subClasses', 'inheritedAttributes']
};

/**
 * 요소 상세 정보 템플릿
 */
const elementDetailTemplate: Template = {
  type: TemplateType.ELEMENT_DETAIL,
  name: '요소 상세 정보',
  description: 'XML 스키마 요소의 상세 정보를 표시하는 템플릿',
  template: `# {{elementName}} 요소

**네임스페이스**: {{namespace}}
**타입**: {{type}}
{{if substitutionGroup}}**대체 그룹**: {{substitutionGroup}}{{endif}}
{{if abstract}}**추상 요소**: 예{{endif}}

## 설명

{{documentation}}

## 속성

{{each attributes}}
### {{item.name}}

- **타입**: {{item.type}}
- **사용**: {{item.use}}
{{if item.default}}- **기본값**: {{item.default}}{{endif}}
{{if item.fixed}}- **고정값**: {{item.fixed}}{{endif}}
{{if item.documentation}}- **설명**: {{item.documentation}}{{endif}}
{{endeach}}

## XML 예제

\`\`\`xml
{{xmlExample}}
\`\`\`
`,
  requiredVariables: ['elementName', 'namespace', 'type'],
  optionalVariables: ['substitutionGroup', 'abstract', 'documentation', 'attributes', 'xmlExample']
};

/**
 * 인코딩 가이드 템플릿
 */
const encodingGuideTemplate: Template = {
  type: TemplateType.ENCODING_GUIDE,
  name: '인코딩 가이드',
  description: '특정 엔티티의 인코딩 가이드 및 예제를 표시하는 템플릿',
  template: `# {{entityName}} 인코딩 가이드

## 개요

{{description}}

## 인코딩 규칙

{{each encodingRules}}
### {{item.name}}

{{item.description}}

적용 대상: {{item.appliesTo}}
{{endeach}}

## 예제

{{each examples}}
### {{item.title}} ({{item.language}})

\`\`\`{{item.language}}
{{item.code}}
\`\`\`
{{endeach}}

## 관련 클래스 및 요소

{{each relatedEntities}}
- **{{item.name}}** ({{item.type}}): {{item.description}}
{{endeach}}
`,
  requiredVariables: ['entityName', 'description'],
  optionalVariables: ['encodingRules', 'examples', 'relatedEntities'],
  formatOptions: {
    codeFormatting: true
  }
};

/**
 * 클래스 비교 템플릿
 */
const compareClassesTemplate: Template = {
  type: TemplateType.COMPARE_CLASSES,
  name: '클래스 비교',
  description: '두 클래스의 특성을 비교하는 템플릿',
  template: `# {{class1Name}}과 {{class2Name}} 비교

## 공통 특성

{{each commonFeatures}}
- **{{item.name}}**: {{item.description}}
{{endeach}}

## 차이점

### {{class1Name}} 고유 특성

{{each class1UniqueFeatures}}
- **{{item.name}}**: {{item.description}}
{{endeach}}

### {{class2Name}} 고유 특성

{{each class2UniqueFeatures}}
- **{{item.name}}**: {{item.description}}
{{endeach}}

## 속성 비교

| 속성 | {{class1Name}} | {{class2Name}} |
|------|--------------|--------------|
{{each attributeComparison}}| {{item.name}} | {{item.class1Value}} | {{item.class2Value}} |
{{endeach}}

## 사용 사례

### {{class1Name}} 사용 사례
{{class1UseCases}}

### {{class2Name}} 사용 사례
{{class2UseCases}}
`,
  requiredVariables: ['class1Name', 'class2Name'],
  optionalVariables: ['commonFeatures', 'class1UniqueFeatures', 'class2UniqueFeatures', 'attributeComparison', 'class1UseCases', 'class2UseCases']
};

/**
 * 스키마 매핑 템플릿
 */
const schemaMappingTemplate: Template = {
  type: TemplateType.SCHEMA_MAPPING,
  name: '스키마 매핑',
  description: '개념 모델과 스키마 간의 매핑을 표시하는 템플릿',
  template: `# {{modelName}} 스키마 매핑

## 개요

이 문서는 {{modelName}} 개념 모델과 XML 스키마 간의 매핑을 설명합니다.

## 클래스-요소 매핑

| 개념 모델 클래스 | XML 스키마 요소 | 비고 |
|-----------------|----------------|------|
{{each classMappings}}| {{item.className}} | {{item.elementName}} | {{item.notes}} |
{{endeach}}

## 속성-요소 매핑

| 개념 모델 속성 | XML 스키마 요소/속성 | 타입 | 비고 |
|---------------|-------------------|------|------|
{{each attributeMappings}}| {{item.attributeName}} | {{item.schemaRepresentation}} | {{item.type}} | {{item.notes}} |
{{endeach}}

## 관계 매핑

| 개념 모델 관계 | XML 스키마 표현 | 비고 |
|---------------|----------------|------|
{{each relationshipMappings}}| {{item.relationshipName}} | {{item.schemaRepresentation}} | {{item.notes}} |
{{endeach}}
`,
  requiredVariables: ['modelName'],
  optionalVariables: ['classMappings', 'attributeMappings', 'relationshipMappings']
};

/**
 * 기능 개요 템플릿
 */
const featureOverviewTemplate: Template = {
  type: TemplateType.FEATURE_OVERVIEW,
  name: '기능 개요',
  description: 'CityGML의 특정 기능에 대한 개요를 표시하는 템플릿',
  template: `# {{featureName}} 기능 개요

## 개요

{{description}}

## 관련 모듈

{{each relatedModules}}
- **{{item.name}}**: {{item.role}}
{{endeach}}

## 주요 클래스

{{each keyClasses}}
### {{item.name}}

{{item.description}}

**주요 속성**:
{{each item.keyAttributes}}
- {{attribute.name}}: {{attribute.description}}
{{endeach}}
{{endeach}}

## 사용 사례

{{each useCases}}
### {{item.title}}

{{item.description}}

{{if item.example}}
**예제**:
\`\`\`
{{item.example}}
\`\`\`
{{endif}}
{{endeach}}

## 모범 사례

{{each bestPractices}}
- **{{item.title}}**: {{item.description}}
{{endeach}}
`,
  requiredVariables: ['featureName', 'description'],
  optionalVariables: ['relatedModules', 'keyClasses', 'useCases', 'bestPractices']
};

// 기본 템플릿 초기화
TemplateManager.initDefaultTemplates(); 