/**
 * CityGML 3.0 인코딩 모델의 타입 정의
 */

export interface EncodingModel {
  version: string;
  encodingType: 'GML' | 'JSON' | 'DB' | 'Other';
  namespaces: Namespace[];
  encodingRules: EncodingRule[];
  examples: Example[];
}

export interface Namespace {
  prefix: string;
  uri: string;
  description?: string;
}

export interface EncodingRule {
  id: string;
  name: string;
  description: string;
  appliesTo: string[]; // 클래스 또는 속성 이름 배열
  examples?: string[];
}

export interface Example {
  id: string;
  title: string;
  description?: string;
  code: string;
  language: 'XML' | 'JSON' | 'SQL' | 'Other';
  relatedClasses: string[];
  relatedRules?: string[];
}

export interface XMLMapping {
  conceptualElement: string; // 클래스 또는 속성 이름
  xmlElement: string; // XML 요소 이름
  xmlType?: string;
  xmlAttributes?: XMLAttributeMapping[];
  xmlContent?: string;
  isAttribute?: boolean;
}

export interface XMLAttributeMapping {
  name: string;
  value?: string;
  isFixed?: boolean;
  isRequired?: boolean;
}

export interface EncodingTemplate {
  name: string;
  description: string;
  pattern: string;
  variables: {
    [key: string]: string;
  };
  examples: string[];
}

export interface EncodingConstraint {
  name: string;
  description: string;
  affectedElements: string[];
  validationRule?: string;
  examples?: {
    valid: string[];
    invalid: string[];
  };
}

export interface EncodingExtension {
  name: string;
  description: string;
  mechanism: 'ADE' | 'GenericAttributes' | 'Other';
  examples: string[];
}

export interface EncodingDocument {
  title: string;
  version: string;
  url: string;
  sections: EncodingSection[];
  model: EncodingModel;
}

export interface EncodingSection {
  id: string;
  title: string;
  content: string;
  subsections?: EncodingSection[];
  examples?: string[];
  relatedClasses?: string[];
} 