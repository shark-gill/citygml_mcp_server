/**
 * XML 처리를 위한 유틸리티 함수
 */
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
// 기본 XML 파싱 옵션
const DEFAULT_PARSING_OPTIONS = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    isArray: (name, jpath) => {
        // 일반적으로 배열로 처리될 수 있는 요소들
        const arrayElements = [
            'element', 'attribute', 'import', 'include',
            'sequence', 'choice', 'all', 'group', 'attributeGroup',
            'enumeration', 'pattern'
        ];
        return arrayElements.includes(name);
    },
    preserveOrder: true,
    parseAttributeValue: true,
    trimValues: true,
    parseTagValue: true,
    cdataPropName: '#cdata'
};
// 기본 XML 빌드 옵션
const DEFAULT_BUILDING_OPTIONS = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    cdataPropName: '#cdata',
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true
};
/**
 * XML 문자열을 파싱하여 객체로 변환하는 함수
 * @param xmlString 파싱할 XML 문자열
 * @param options 파싱 옵션
 * @returns 파싱된 객체
 */
export function parseXml(xmlString, options) {
    const parser = new XMLParser({
        ...DEFAULT_PARSING_OPTIONS,
        ...options
    });
    const isValid = XMLValidator.validate(xmlString);
    if (isValid !== true) {
        throw new Error(`유효하지 않은 XML: ${isValid.err?.msg}`);
    }
    return parser.parse(xmlString);
}
/**
 * 객체를 XML 문자열로 변환하는 함수
 * @param obj 변환할 객체
 * @param options 빌드 옵션
 * @returns XML 문자열
 */
export function buildXml(obj, options) {
    const builder = new XMLBuilder({
        ...DEFAULT_BUILDING_OPTIONS,
        ...options
    });
    return builder.build(obj);
}
/**
 * XSD 스키마 문서를 파싱하는 함수
 * @param xsdContent XSD 내용
 * @param fileName 파일 이름
 * @returns 파싱된 스키마 문서
 */
export function parseXsdSchema(xsdContent, fileName) {
    const parsedXsd = parseXml(xsdContent);
    // 스키마 문서 기본 구조 초기화
    const schema = {
        fileName,
        targetNamespace: '',
        imports: [],
        elements: [],
        complexTypes: [],
        simpleTypes: [],
        groups: [],
        attributes: [],
        attributeGroups: []
    };
    // 스키마 요소 추출
    const schemaNode = findSchemaNode(parsedXsd);
    if (!schemaNode) {
        throw new Error('스키마 노드를 찾을 수 없습니다');
    }
    // 스키마 기본 속성 설정
    schema.targetNamespace = getNodeAttribute(schemaNode, 'targetNamespace') || '';
    schema.version = getNodeAttribute(schemaNode, 'version');
    // 가져오기 처리
    extractImports(schemaNode, schema);
    // 요소, 타입, 그룹 등 추출
    extractElements(schemaNode, schema);
    extractComplexTypes(schemaNode, schema);
    extractSimpleTypes(schemaNode, schema);
    extractGroups(schemaNode, schema);
    extractAttributes(schemaNode, schema);
    extractAttributeGroups(schemaNode, schema);
    return schema;
}
/**
 * 스키마 노드 찾기
 */
function findSchemaNode(parsedXsd) {
    // 다양한 루트 구조 처리
    if (parsedXsd.schema)
        return parsedXsd.schema;
    if (parsedXsd['xs:schema'])
        return parsedXsd['xs:schema'];
    if (parsedXsd['xsd:schema'])
        return parsedXsd['xsd:schema'];
    // 객체 순회하여 스키마 찾기
    for (const key in parsedXsd) {
        const value = parsedXsd[key];
        if (typeof value === 'object' && value !== null) {
            if (key === 'schema' || key === 'xs:schema' || key === 'xsd:schema') {
                return value;
            }
            const nested = findSchemaNode(value);
            if (nested)
                return nested;
        }
    }
    return null;
}
/**
 * 노드 속성 가져오기
 */
function getNodeAttribute(node, attributeName) {
    // 속성 접두어 처리
    const attributeKeys = [
        `@_${attributeName}`,
        `@_xs:${attributeName}`,
        `@_xsd:${attributeName}`
    ];
    for (const key of attributeKeys) {
        if (node[key] !== undefined) {
            return node[key].toString();
        }
    }
    return undefined;
}
/**
 * 가져오기 추출
 */
function extractImports(schemaNode, schema) {
    const imports = findNodes(schemaNode, 'import') || [];
    for (const importNode of imports) {
        const namespace = getNodeAttribute(importNode, 'namespace');
        const schemaLocation = getNodeAttribute(importNode, 'schemaLocation');
        if (namespace && schemaLocation) {
            schema.imports.push({
                namespace,
                schemaLocation
            });
        }
    }
}
/**
 * 요소 추출
 */
function extractElements(schemaNode, schema) {
    const elements = findNodes(schemaNode, 'element') || [];
    for (const elementNode of elements) {
        const element = {
            name: getNodeAttribute(elementNode, 'name') || '',
            type: getNodeAttribute(elementNode, 'type'),
            substitutionGroup: getNodeAttribute(elementNode, 'substitutionGroup'),
            abstract: getNodeAttribute(elementNode, 'abstract') === 'true',
            minOccurs: getNodeAttribute(elementNode, 'minOccurs'),
            maxOccurs: getNodeAttribute(elementNode, 'maxOccurs'),
            nillable: getNodeAttribute(elementNode, 'nillable') === 'true'
        };
        // 문서화 추출
        element.documentation = extractDocumentation(elementNode);
        // 인라인 복합 타입 처리
        const complexTypeNode = findNode(elementNode, 'complexType');
        if (complexTypeNode) {
            element.complexType = extractComplexTypeContent(complexTypeNode);
        }
        // 인라인 단순 타입 처리
        const simpleTypeNode = findNode(elementNode, 'simpleType');
        if (simpleTypeNode) {
            // 여기에 단순 타입 추출 로직 추가
        }
        schema.elements.push(element);
    }
}
/**
 * 복합 타입 추출
 */
function extractComplexTypes(schemaNode, schema) {
    const complexTypes = findNodes(schemaNode, 'complexType') || [];
    for (const complexTypeNode of complexTypes) {
        const complexType = extractComplexTypeContent(complexTypeNode);
        if (complexType.name) {
            schema.complexTypes.push(complexType);
        }
    }
}
/**
 * 복합 타입 내용 추출
 */
function extractComplexTypeContent(complexTypeNode) {
    const complexType = {
        name: getNodeAttribute(complexTypeNode, 'name'),
        abstract: getNodeAttribute(complexTypeNode, 'abstract') === 'true',
        mixed: getNodeAttribute(complexTypeNode, 'mixed') === 'true',
        attributes: []
    };
    // 문서화 추출
    complexType.documentation = extractDocumentation(complexTypeNode);
    // 속성 추출
    extractAttributesFromType(complexTypeNode, complexType);
    // 확장 또는 제한 처리
    const extension = findNode(findNode(complexTypeNode, 'complexContent'), 'extension');
    if (extension) {
        complexType.base = getNodeAttribute(extension, 'base');
        complexType.derivation = 'extension';
        extractAttributesFromType(extension, complexType);
    }
    const restriction = findNode(findNode(complexTypeNode, 'complexContent'), 'restriction');
    if (restriction) {
        complexType.base = getNodeAttribute(restriction, 'base');
        complexType.derivation = 'restriction';
        extractAttributesFromType(restriction, complexType);
    }
    // 시퀀스, 초이스, 올 처리
    const sequence = findNode(complexTypeNode, 'sequence');
    if (sequence) {
        // 임시 스키마 문서 생성
        const tempSchema = {
            fileName: '',
            targetNamespace: '',
            imports: [],
            elements: [],
            complexTypes: [],
            simpleTypes: [],
            groups: [],
            attributes: [],
            attributeGroups: []
        };
        // 요소 추출
        extractElements(sequence, tempSchema);
        complexType.sequence = tempSchema.elements;
    }
    return complexType;
}
/**
 * 타입에서 속성 추출
 */
function extractAttributesFromType(typeNode, complexType) {
    const attributes = findNodes(typeNode, 'attribute') || [];
    for (const attributeNode of attributes) {
        complexType.attributes.push({
            name: getNodeAttribute(attributeNode, 'name'),
            ref: getNodeAttribute(attributeNode, 'ref'),
            type: getNodeAttribute(attributeNode, 'type'),
            use: getNodeAttribute(attributeNode, 'use'),
            default: getNodeAttribute(attributeNode, 'default'),
            fixed: getNodeAttribute(attributeNode, 'fixed'),
            documentation: extractDocumentation(attributeNode)
        });
    }
}
/**
 * 문서화 추출
 */
function extractDocumentation(node) {
    const annotation = findNode(node, 'annotation');
    if (!annotation)
        return undefined;
    const documentation = findNode(annotation, 'documentation');
    if (!documentation)
        return undefined;
    // 텍스트 노드 또는 CDATA 처리
    if (documentation['#text'])
        return documentation['#text'];
    if (documentation['#cdata'])
        return documentation['#cdata'];
    return undefined;
}
/**
 * 단순 타입 추출
 */
function extractSimpleTypes(schemaNode, schema) {
    // 단순 타입 추출 로직 구현...
}
/**
 * 그룹 추출
 */
function extractGroups(schemaNode, schema) {
    // 그룹 추출 로직 구현...
}
/**
 * 속성 추출
 */
function extractAttributes(schemaNode, schema) {
    // 전역 속성 추출 로직 구현...
}
/**
 * 속성 그룹 추출
 */
function extractAttributeGroups(schemaNode, schema) {
    // 속성 그룹 추출 로직 구현...
}
/**
 * 특정 이름의 노드 찾기
 */
function findNode(parentNode, nodeName) {
    if (!parentNode)
        return null;
    // 다양한 네임스페이스 처리
    const nodeNames = [
        nodeName,
        `xs:${nodeName}`,
        `xsd:${nodeName}`
    ];
    for (const name of nodeNames) {
        if (parentNode[name] !== undefined) {
            return parentNode[name];
        }
    }
    return null;
}
/**
 * 특정 이름의 노드 배열 찾기
 */
function findNodes(parentNode, nodeName) {
    if (!parentNode)
        return [];
    // 다양한 네임스페이스 처리
    const nodeNames = [
        nodeName,
        `xs:${nodeName}`,
        `xsd:${nodeName}`
    ];
    for (const name of nodeNames) {
        if (parentNode[name] !== undefined) {
            const nodes = parentNode[name];
            return Array.isArray(nodes) ? nodes : [nodes];
        }
    }
    return [];
}
