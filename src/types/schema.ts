/**
 * CityGML 3.0 XSD 스키마 관련 타입 정의
 */

export interface SchemaDocument {
  fileName: string;
  targetNamespace: string;
  version?: string;
  imports: SchemaImport[];
  elements: SchemaElement[];
  complexTypes: SchemaComplexType[];
  simpleTypes: SchemaSimpleType[];
  groups: SchemaGroup[];
  attributes: SchemaAttribute[];
  attributeGroups: SchemaAttributeGroup[];
}

export interface SchemaImport {
  namespace: string;
  schemaLocation: string;
}

export interface SchemaElement {
  name: string;
  type?: string;
  substitutionGroup?: string;
  abstract?: boolean;
  documentation?: string;
  complexType?: SchemaComplexType;
  simpleType?: SchemaSimpleType;
  minOccurs?: string;
  maxOccurs?: string;
  nillable?: boolean;
}

export interface SchemaComplexType {
  name?: string;
  abstract?: boolean;
  mixed?: boolean;
  documentation?: string;
  base?: string;
  derivation?: 'extension' | 'restriction';
  attributes: SchemaAttribute[];
  attributeGroups?: string[];
  elements?: SchemaElement[];
  groups?: {
    ref: string;
    minOccurs?: string;
    maxOccurs?: string;
  }[];
  sequence?: SchemaElement[];
  choice?: SchemaElement[];
  all?: SchemaElement[];
  any?: {
    namespace?: string;
    processContents?: 'lax' | 'skip' | 'strict';
    minOccurs?: string;
    maxOccurs?: string;
  };
}

export interface SchemaSimpleType {
  name?: string;
  documentation?: string;
  restriction?: {
    base: string;
    enumeration?: {
      value: string;
      documentation?: string;
    }[];
    pattern?: {
      value: string;
    }[];
    minInclusive?: string;
    maxInclusive?: string;
    minExclusive?: string;
    maxExclusive?: string;
    length?: string;
    minLength?: string;
    maxLength?: string;
    totalDigits?: string;
    fractionDigits?: string;
  };
  list?: {
    itemType: string;
  };
  union?: {
    memberTypes: string[];
  };
}

export interface SchemaAttribute {
  name?: string;
  ref?: string;
  type?: string;
  use?: 'optional' | 'required' | 'prohibited';
  default?: string;
  fixed?: string;
  documentation?: string;
  simpleType?: SchemaSimpleType;
}

export interface SchemaGroup {
  name: string;
  documentation?: string;
  elements?: SchemaElement[];
  sequence?: SchemaElement[];
  choice?: SchemaElement[];
  all?: SchemaElement[];
  groups?: {
    ref: string;
    minOccurs?: string;
    maxOccurs?: string;
  }[];
}

export interface SchemaAttributeGroup {
  name: string;
  documentation?: string;
  attributes: SchemaAttribute[];
  attributeGroups?: string[];
}

export interface SchemaRegistry {
  schemas: {
    [namespace: string]: SchemaDocument[];
  };
  elementsByName: {
    [name: string]: SchemaElement[];
  };
  typesByName: {
    [name: string]: (SchemaComplexType | SchemaSimpleType)[];
  };
  moduleToNamespace: {
    [module: string]: string;
  };
} 