/**
 * CityGML 3.0 개념 모델의 타입 정의
 */

export interface ConceptualModel {
  version: string;
  modules: Module[];
}

export interface Module {
  name: string;
  namespace: string;
  description: string;
  classes: Class[];
  codelists?: Codelist[];
  enumerations?: Enumeration[];
  dependencies?: string[];
}

export interface Class {
  name: string;
  description: string;
  module: string;
  stereotype?: string;
  superClasses?: string[];
  attributes: Attribute[];
  associations?: Association[];
  constraints?: Constraint[];
  isAbstract?: boolean;
}

export interface Attribute {
  name: string;
  description?: string;
  type: string;
  cardinality: string;
  isNillable?: boolean;
  defaultValue?: string;
}

export interface Association {
  name: string;
  description?: string;
  target: string;
  cardinality: string;
  role?: string;
  aggregationType?: 'composition' | 'aggregation' | 'association';
}

export interface Constraint {
  name: string;
  description: string;
  expression?: string;
}

export interface Codelist {
  name: string;
  description: string;
  values: CodelistValue[];
}

export interface CodelistValue {
  code: string;
  description?: string;
}

export interface Enumeration {
  name: string;
  description: string;
  values: EnumerationValue[];
}

export interface EnumerationValue {
  name: string;
  description?: string;
}

export interface UMLDiagram {
  id: string;
  title: string;
  url?: string;
  elements: UMLElement[];
}

export interface UMLElement {
  id: string;
  type: 'class' | 'package' | 'interface' | 'relationship';
  name: string;
  properties?: {
    [key: string]: any;
  };
}

export interface ConceptModelSection {
  id: string;
  title: string;
  content: string;
  subsections?: ConceptModelSection[];
  relatedClasses?: string[];
  relatedDiagrams?: string[];
  conceptName?: string;
  conceptType?: 'class' | 'codelist' | 'enumeration';
  moduleName?: string;
  sectionTitle?: string;
  sectionId?: string;
  summary?: string;
}

export interface ConceptModelDocument {
  title: string;
  version: string;
  url: string;
  sections: ConceptModelSection[];
  diagrams: UMLDiagram[];
  model: ConceptualModel;
} 