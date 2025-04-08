import fs from 'fs';
import path from 'path';
import xpath from 'xpath';
import { DOMParser } from 'xmldom';
import { ConceptExtractor } from './concepts.js';
import { ObjectExtractor } from './objects.js';
import { logger } from '../utils/logger.js';
/**
 * 관계 유형을 나타내는 열거형
 */
export var RelationshipType;
(function (RelationshipType) {
    RelationshipType["ASSOCIATION"] = "association";
    RelationshipType["AGGREGATION"] = "aggregation";
    RelationshipType["COMPOSITION"] = "composition";
    RelationshipType["GENERALIZATION"] = "generalization";
    RelationshipType["SPATIAL"] = "spatial";
    RelationshipType["TEMPORAL"] = "temporal";
    RelationshipType["THEMATIC"] = "thematic"; // 주제적 관계
})(RelationshipType || (RelationshipType = {}));
/**
 * 관계의 방향성을 나타내는 열거형
 */
export var RelationshipDirection;
(function (RelationshipDirection) {
    RelationshipDirection["UNIDIRECTIONAL"] = "unidirectional";
    RelationshipDirection["BIDIRECTIONAL"] = "bidirectional"; // 양방향
})(RelationshipDirection || (RelationshipDirection = {}));
/**
 * 공간 관계 유형을 나타내는 열거형
 */
export var SpatialRelationType;
(function (SpatialRelationType) {
    SpatialRelationType["CONTAINS"] = "contains";
    SpatialRelationType["WITHIN"] = "within";
    SpatialRelationType["TOUCHES"] = "touches";
    SpatialRelationType["OVERLAPS"] = "overlaps";
    SpatialRelationType["DISJOINT"] = "disjoint";
    SpatialRelationType["EQUALS"] = "equals";
    SpatialRelationType["CROSSES"] = "crosses";
    SpatialRelationType["INTERSECTS"] = "intersects";
    SpatialRelationType["REFERENCES"] = "references"; // 참조
})(SpatialRelationType || (SpatialRelationType = {}));
/**
 * CityGML 문서에서 객체 간의 관계를 추출하는 클래스
 */
export class RelationshipExtractor {
    /**
     * RelationshipExtractor 생성자
     */
    constructor() {
        this.conceptExtractor = null;
        this.objectExtractor = null;
        this.relationships = new Map();
        this.xsdBasePath = '';
        this.moduleNamespaces = new Map();
        this.moduleXsdDocs = {};
        this.processedModules = new Set();
        this.conceptualModel = null;
        this.parser = new DOMParser();
    }
    /**
     * 개념 추출기 설정
     * @param conceptExtractor - 사용할 개념 추출기 인스턴스
     */
    setConceptExtractor(conceptExtractor) {
        this.conceptExtractor = conceptExtractor;
    }
    /**
     * 객체 추출기 설정
     * @param objectExtractor - 사용할 객체 추출기 인스턴스
     */
    setObjectExtractor(objectExtractor) {
        this.objectExtractor = objectExtractor;
    }
    /**
     * XSD 베이스 경로 설정
     * @param basePath - XSD 파일이 위치한 기본 경로
     */
    setXsdBasePath(basePath) {
        this.xsdBasePath = basePath;
    }
    /**
     * 지정된 XSD 파일에서 관계 정보 추출 초기화
     * @param xsdFilePaths - 처리할 XSD 파일 경로 배열
     */
    async extractRelationships(xsdFilePaths) {
        if (!this.conceptExtractor) {
            throw new Error('개념 추출기가 설정되지 않았습니다. setConceptExtractor()를 먼저 호출하세요.');
        }
        if (!this.objectExtractor) {
            throw new Error('객체 추출기가 설정되지 않았습니다. setObjectExtractor()를 먼저 호출하세요.');
        }
        this.relationships.clear();
        this.moduleNamespaces.clear();
        this.moduleXsdDocs = {};
        // 모듈 XSD 문서 로드 및 분석
        for (const xsdFilePath of xsdFilePaths) {
            try {
                await this.processModuleFile(xsdFilePath);
            }
            catch (error) {
                logger.error(`XSD 파일 처리 중 오류 발생: ${xsdFilePath}`, error);
            }
        }
        // 일반화 관계(상속) 추출
        this.extractGeneralizationRelationships();
        // 연관, 집합, 합성 관계 추출
        this.extractAssociationRelationships();
        // 공간 관계 추출
        this.extractSpatialRelationships();
        // 참조 무결성 규칙 추출
        this.extractReferentialIntegrityRules();
        return this.relationships;
    }
    /**
     * 단일 XSD 모듈 파일 처리
     * @param xsdFilePath - 처리할 XSD 파일 경로
     */
    async processModuleFile(xsdFilePath) {
        logger.info(`모듈 파일 처리 중: ${xsdFilePath}`);
        try {
            const fileContent = await fs.promises.readFile(xsdFilePath, 'utf-8');
            const moduleXsdDoc = this.parser.parseFromString(fileContent, 'application/xml');
            // 모듈의 스키마 요소 찾기
            const schemaElements = xpath.select('//xs:schema', moduleXsdDoc);
            if (!schemaElements || schemaElements.length === 0) {
                logger.warn(`스키마 요소를 찾을 수 없음: ${xsdFilePath}`);
                return;
            }
            const schemaElement = schemaElements[0];
            const targetNamespace = schemaElement.getAttribute('targetNamespace');
            if (targetNamespace) {
                const moduleName = path.basename(xsdFilePath, '.xsd');
                this.moduleNamespaces.set(moduleName, targetNamespace);
                this.moduleXsdDocs[moduleName] = moduleXsdDoc;
                logger.debug(`모듈 네임스페이스 매핑: ${moduleName} -> ${targetNamespace}`);
            }
            else {
                logger.warn(`대상 네임스페이스를 찾을 수 없음: ${xsdFilePath}`);
            }
        }
        catch (error) {
            logger.error(`XSD 파일 읽기 또는 파싱 중 오류 발생: ${xsdFilePath}`, error);
            throw error;
        }
    }
    /**
     * 일반화 관계(상속) 추출
     */
    extractGeneralizationRelationships() {
        logger.info('일반화 관계(상속) 추출 중...');
        if (!this.conceptExtractor) {
            logger.warn('개념 추출기가 없어 일반화 관계를 추출할 수 없습니다.');
            return;
        }
        // 각 모듈 XSD 문서 처리
        for (const [moduleName, moduleDoc] of Object.entries(this.moduleXsdDocs)) {
            try {
                // 복합 타입 요소 추출
                const complexTypeElements = xpath.select('//xs:complexType', moduleDoc);
                for (const complexTypeNode of complexTypeElements) {
                    const complexTypeElement = complexTypeNode;
                    const typeName = complexTypeElement.getAttribute('name');
                    if (!typeName)
                        continue;
                    // 확장(extension) 요소 찾기
                    const extensionElements = xpath.select('.//xs:extension', complexTypeElement);
                    for (const extensionNode of extensionElements) {
                        const extensionElement = extensionNode;
                        const baseTypeName = extensionElement.getAttribute('base');
                        if (!baseTypeName)
                            continue;
                        // 네임스페이스 접두사 처리
                        const baseTypeNameParts = baseTypeName.split(':');
                        const baseTypeNameWithoutPrefix = baseTypeNameParts.length > 1 ? baseTypeNameParts[1] : baseTypeNameParts[0];
                        // 일반화 관계 생성
                        const relationshipId = `generalization_${typeName}_${baseTypeNameWithoutPrefix}`;
                        const relationship = {
                            id: relationshipId,
                            name: `${typeName}_extends_${baseTypeNameWithoutPrefix}`,
                            type: RelationshipType.GENERALIZATION,
                            source: typeName,
                            target: baseTypeNameWithoutPrefix,
                            sourceMultiplicity: { min: 0, max: '*' },
                            targetMultiplicity: { min: 1, max: 1 },
                            direction: RelationshipDirection.UNIDIRECTIONAL,
                            description: `${typeName}는 ${baseTypeNameWithoutPrefix}의 서브타입입니다`,
                            xsdPath: path.join(this.xsdBasePath, `${moduleName}.xsd`)
                        };
                        this.relationships.set(relationshipId, relationship);
                        logger.debug(`일반화 관계 추출: ${typeName} -> ${baseTypeNameWithoutPrefix}`);
                    }
                }
            }
            catch (error) {
                logger.error(`모듈 ${moduleName}에서 일반화 관계 추출 중 오류 발생`, error);
            }
        }
        logger.info(`총 ${this.countRelationshipsByType(RelationshipType.GENERALIZATION)}개의 일반화 관계가 추출되었습니다.`);
    }
    /**
     * 연관, 집합, 합성 관계 추출
     */
    extractAssociationRelationships() {
        logger.info('연관, 집합, 합성 관계 추출 중...');
        // 각 모듈 XSD 문서 처리
        for (const [moduleName, moduleDoc] of Object.entries(this.moduleXsdDocs)) {
            try {
                // 요소 참조와 요소 그룹을 통해 연관 관계 추출
                this.extractRelationshipsFromElements(moduleDoc, moduleName);
                // 속성 참조를 통해 연관 관계 추출
                this.extractRelationshipsFromAttributes(moduleDoc, moduleName);
            }
            catch (error) {
                logger.error(`모듈 ${moduleName}에서 연관 관계 추출 중 오류 발생`, error);
            }
        }
        logger.info(`총 ${this.countRelationshipsByType(RelationshipType.ASSOCIATION) +
            this.countRelationshipsByType(RelationshipType.AGGREGATION) +
            this.countRelationshipsByType(RelationshipType.COMPOSITION)}개의 연관/집합/합성 관계가 추출되었습니다.`);
    }
    /**
     * 요소 참조와 요소 그룹을 통한 관계 추출
     * @param moduleDoc - 모듈 XSD 문서
     * @param moduleName - 모듈 이름
     */
    extractRelationshipsFromElements(moduleDoc, moduleName) {
        // 복합 타입 내의 요소 추출
        const elementNodes = xpath.select('//xs:element', moduleDoc);
        for (const elementNode of elementNodes) {
            const elementElement = elementNode;
            const elementName = elementElement.getAttribute('name');
            const elementRef = elementElement.getAttribute('ref');
            const elementType = elementElement.getAttribute('type');
            // 참조 요소인 경우 연관 관계 처리
            if (elementRef) {
                this.processElementReference(elementElement, elementRef, moduleName);
                continue;
            }
            // 타입이 지정된 요소인 경우 연관 관계 처리
            if (elementName && elementType) {
                this.processElementWithType(elementElement, elementName, elementType, moduleName);
            }
        }
    }
    /**
     * 요소 참조 처리 - ref 속성으로 정의된 요소 참조 분석
     * @param elementElement - 요소 엘리먼트
     * @param elementRef - 참조 요소 이름
     * @param moduleName - 모듈 이름
     */
    processElementReference(elementElement, elementRef, moduleName) {
        // 참조 요소의 네임스페이스 접두사 처리
        const refParts = elementRef.split(':');
        const refWithoutPrefix = refParts.length > 1 ? refParts[1] : refParts[0];
        // 상위 복합 타입 찾기
        let parentElement = elementElement.parentNode;
        let sourceTypeName = '';
        while (parentElement) {
            if (parentElement.nodeName === 'xs:complexType' && parentElement.getAttribute('name')) {
                sourceTypeName = parentElement.getAttribute('name') || '';
                break;
            }
            parentElement = parentElement.parentNode;
        }
        if (!sourceTypeName)
            return;
        // 다중성 분석
        const minOccurs = elementElement.getAttribute('minOccurs') || '1';
        const maxOccurs = elementElement.getAttribute('maxOccurs') || '1';
        const sourceMultiplicity = {
            min: 1,
            max: 1
        };
        const targetMultiplicity = {
            min: parseInt(minOccurs, 10),
            max: maxOccurs === 'unbounded' ? '*' : parseInt(maxOccurs, 10)
        };
        // 관계 유형 결정 (기본적으로 연관관계로 설정)
        let relationType = RelationshipType.ASSOCIATION;
        // 요소 이름에 기반하여 집합/합성 관계 파악
        const elementParent = elementElement.parentNode;
        if (elementParent && elementParent.nodeName === 'xs:sequence') {
            // 일반적으로 시퀀스 내의 요소는 합성 또는 집합 관계를 나타냄
            relationType = RelationshipType.COMPOSITION;
        }
        // 관계 ID 및 이름 생성
        const relationshipId = `${relationType.toLowerCase()}_${sourceTypeName}_${refWithoutPrefix}`;
        const relationshipName = `${sourceTypeName}_has_${refWithoutPrefix}`;
        // 관계 정보 생성
        const relationship = {
            id: relationshipId,
            name: relationshipName,
            type: relationType,
            source: sourceTypeName,
            target: refWithoutPrefix,
            sourceMultiplicity,
            targetMultiplicity,
            direction: RelationshipDirection.UNIDIRECTIONAL,
            xsdPath: path.join(this.xsdBasePath, `${moduleName}.xsd`)
        };
        this.relationships.set(relationshipId, relationship);
        logger.debug(`연관 관계 추출: ${sourceTypeName} -> ${refWithoutPrefix} (${relationType})`);
    }
    /**
     * 타입이 지정된 요소 처리 - type 속성으로 정의된 요소 분석
     * @param elementElement - 요소 엘리먼트
     * @param elementName - 요소 이름
     * @param elementType - 요소 타입
     * @param moduleName - 모듈 이름
     */
    processElementWithType(elementElement, elementName, elementType, moduleName) {
        // 타입의 네임스페이스 접두사 처리
        const typeParts = elementType.split(':');
        const typeWithoutPrefix = typeParts.length > 1 ? typeParts[1] : typeParts[0];
        // 기본 타입(xs:string, xs:integer 등)이면 건너뜀
        if (typeParts.length > 1 && typeParts[0] === 'xs')
            return;
        // 상위 복합 타입 찾기
        let parentElement = elementElement.parentNode;
        let sourceTypeName = '';
        while (parentElement) {
            if (parentElement.nodeName === 'xs:complexType' && parentElement.getAttribute('name')) {
                sourceTypeName = parentElement.getAttribute('name') || '';
                break;
            }
            parentElement = parentElement.parentNode;
        }
        if (!sourceTypeName)
            return;
        // 다중성 분석
        const minOccurs = elementElement.getAttribute('minOccurs') || '1';
        const maxOccurs = elementElement.getAttribute('maxOccurs') || '1';
        const sourceMultiplicity = {
            min: 1,
            max: 1
        };
        const targetMultiplicity = {
            min: parseInt(minOccurs, 10),
            max: maxOccurs === 'unbounded' ? '*' : parseInt(maxOccurs, 10)
        };
        // 관계 유형 결정
        let relationType = RelationshipType.ASSOCIATION;
        // 요소 이름에 기반하여 관계 유형 결정
        if (elementName.endsWith('Member') || elementName.includes('members')) {
            relationType = RelationshipType.AGGREGATION;
        }
        else if (elementName.endsWith('Part') || elementName.includes('parts')) {
            relationType = RelationshipType.COMPOSITION;
        }
        // 관계 ID 및 이름 생성
        const relationshipId = `${relationType.toLowerCase()}_${sourceTypeName}_${elementName}_${typeWithoutPrefix}`;
        const relationshipName = `${sourceTypeName}_${elementName}_${typeWithoutPrefix}`;
        // 관계 정보 생성
        const relationship = {
            id: relationshipId,
            name: relationshipName,
            type: relationType,
            source: sourceTypeName,
            target: typeWithoutPrefix,
            sourceRole: sourceTypeName.toLowerCase(),
            targetRole: elementName,
            sourceMultiplicity,
            targetMultiplicity,
            direction: RelationshipDirection.UNIDIRECTIONAL,
            xsdPath: path.join(this.xsdBasePath, `${moduleName}.xsd`)
        };
        this.relationships.set(relationshipId, relationship);
        logger.debug(`연관 관계 추출: ${sourceTypeName} -> ${typeWithoutPrefix} (${relationType})`);
    }
    /**
     * 속성을 통한 관계 추출
     * @param moduleDoc - 모듈 XSD 문서
     * @param moduleName - 모듈 이름
     */
    extractRelationshipsFromAttributes(moduleDoc, moduleName) {
        // 속성 노드 추출
        const attributeNodes = xpath.select('//xs:attribute', moduleDoc);
        for (const attributeNode of attributeNodes) {
            const attributeElement = attributeNode;
            const attributeName = attributeElement.getAttribute('name');
            const attributeType = attributeElement.getAttribute('type');
            const attributeRef = attributeElement.getAttribute('ref');
            // 참조 속성 처리
            if (attributeRef) {
                this.processAttributeReference(attributeElement, attributeRef, moduleName);
                continue;
            }
            // 타입이 있는 속성 처리
            if (attributeName && attributeType) {
                this.processAttributeWithType(attributeElement, attributeName, attributeType, moduleName);
            }
        }
    }
    /**
     * 속성 참조 처리
     * @param attributeElement - 속성 엘리먼트
     * @param attributeRef - 참조 속성 이름
     * @param moduleName - 모듈 이름
     */
    processAttributeReference(attributeElement, attributeRef, moduleName) {
        // 참조 속성의 네임스페이스 접두사 처리
        const refParts = attributeRef.split(':');
        const refWithoutPrefix = refParts.length > 1 ? refParts[1] : refParts[0];
        // xlink:href와 같은 특수 참조인 경우 공간 관계로 처리
        if (refParts.length > 1 && refParts[0] === 'xlink' && refWithoutPrefix === 'href') {
            this.processXlinkReference(attributeElement, moduleName);
            return;
        }
        // 상위 복합 타입 찾기
        let parentElement = attributeElement.parentNode;
        let sourceTypeName = '';
        while (parentElement) {
            if (parentElement.nodeName === 'xs:complexType' && parentElement.getAttribute('name')) {
                sourceTypeName = parentElement.getAttribute('name') || '';
                break;
            }
            parentElement = parentElement.parentNode;
        }
        if (!sourceTypeName)
            return;
        // 관계 ID 및 이름 생성
        const relationshipId = `association_${sourceTypeName}_${refWithoutPrefix}`;
        const relationshipName = `${sourceTypeName}_refers_to_${refWithoutPrefix}`;
        // 관계 정보 생성
        const relationship = {
            id: relationshipId,
            name: relationshipName,
            type: RelationshipType.ASSOCIATION,
            source: sourceTypeName,
            target: refWithoutPrefix,
            sourceMultiplicity: { min: 1, max: 1 },
            targetMultiplicity: { min: 0, max: 1 },
            direction: RelationshipDirection.UNIDIRECTIONAL,
            xsdPath: path.join(this.xsdBasePath, `${moduleName}.xsd`)
        };
        this.relationships.set(relationshipId, relationship);
        logger.debug(`속성 참조 관계 추출: ${sourceTypeName} -> ${refWithoutPrefix}`);
    }
    /**
     * 타입이 있는 속성 처리
     * @param attributeElement - 속성 엘리먼트
     * @param attributeName - 속성 이름
     * @param attributeType - 속성 타입
     * @param moduleName - 모듈 이름
     */
    processAttributeWithType(attributeElement, attributeName, attributeType, moduleName) {
        // 타입의 네임스페이스 접두사 처리
        const typeParts = attributeType.split(':');
        const typeWithoutPrefix = typeParts.length > 1 ? typeParts[1] : typeParts[0];
        // 기본 타입(xs:string, xs:integer 등)이면 건너뜀
        if (typeParts.length > 1 && typeParts[0] === 'xs')
            return;
        // 상위 복합 타입 찾기
        let parentElement = attributeElement.parentNode;
        let sourceTypeName = '';
        while (parentElement) {
            if (parentElement.nodeName === 'xs:complexType' && parentElement.getAttribute('name')) {
                sourceTypeName = parentElement.getAttribute('name') || '';
                break;
            }
            parentElement = parentElement.parentNode;
        }
        if (!sourceTypeName)
            return;
        // 관계 ID 및 이름 생성
        const relationshipId = `association_${sourceTypeName}_${attributeName}_${typeWithoutPrefix}`;
        const relationshipName = `${sourceTypeName}_${attributeName}_${typeWithoutPrefix}`;
        // 관계 정보 생성
        const relationship = {
            id: relationshipId,
            name: relationshipName,
            type: RelationshipType.ASSOCIATION,
            source: sourceTypeName,
            target: typeWithoutPrefix,
            sourceRole: sourceTypeName.toLowerCase(),
            targetRole: attributeName,
            sourceMultiplicity: { min: 1, max: 1 },
            targetMultiplicity: { min: 0, max: 1 },
            direction: RelationshipDirection.UNIDIRECTIONAL,
            xsdPath: path.join(this.xsdBasePath, `${moduleName}.xsd`)
        };
        this.relationships.set(relationshipId, relationship);
        logger.debug(`속성 타입 관계 추출: ${sourceTypeName} -> ${typeWithoutPrefix}`);
    }
    /**
     * xlink:href 참조 처리 (공간 관계 추출)
     * @param attributeElement - 속성 엘리먼트
     * @param moduleName - 모듈 이름
     */
    processXlinkReference(attributeElement, moduleName) {
        // 상위 복합 타입 찾기
        let parentElement = attributeElement.parentNode;
        let sourceTypeName = '';
        while (parentElement) {
            if (parentElement.nodeName === 'xs:complexType' && parentElement.getAttribute('name')) {
                sourceTypeName = parentElement.getAttribute('name') || '';
                break;
            }
            parentElement = parentElement.parentNode;
        }
        if (!sourceTypeName)
            return;
        // 추가 속성 정보 (예: gml:AssociationAttributeGroup)에서 관계 정보 추출
        const attributeGroup = parentElement?.getAttribute('attributeGroup');
        let targetTypeName = 'Unknown';
        if (attributeGroup) {
            const groupParts = attributeGroup.split(':');
            const groupWithoutPrefix = groupParts.length > 1 ? groupParts[1] : groupParts[0];
            if (groupWithoutPrefix.endsWith('PropertyType')) {
                targetTypeName = groupWithoutPrefix.replace('PropertyType', '');
            }
        }
        // 관계 ID 및 이름 생성
        const relationshipId = `spatial_${sourceTypeName}_${targetTypeName}`;
        const relationshipName = `${sourceTypeName}_spatially_related_to_${targetTypeName}`;
        // 관계 정보 생성
        const relationship = {
            id: relationshipId,
            name: relationshipName,
            type: RelationshipType.SPATIAL,
            source: sourceTypeName,
            target: targetTypeName,
            sourceMultiplicity: { min: 1, max: 1 },
            targetMultiplicity: { min: 0, max: '*' },
            direction: RelationshipDirection.UNIDIRECTIONAL,
            spatialType: SpatialRelationType.REFERENCES,
            xsdPath: path.join(this.xsdBasePath, `${moduleName}.xsd`)
        };
        this.relationships.set(relationshipId, relationship);
        logger.debug(`공간 관계 추출: ${sourceTypeName} -> ${targetTypeName}`);
    }
    /**
     * 공간 관계 추출
     */
    extractSpatialRelationships() {
        logger.info('공간 관계 추출 중...');
        if (!this.objectExtractor) {
            logger.warn('객체 추출기가 없어 공간 관계를 추출할 수 없습니다.');
            return;
        }
        // 지오메트리 관계 추출
        this.extractGeometryRelationships();
        logger.info(`총 ${this.countRelationshipsByType(RelationshipType.SPATIAL)}개의 공간 관계가 추출되었습니다.`);
    }
    /**
     * 지오메트리 관계 추출 (GML 기반)
     */
    extractGeometryRelationships() {
        // 각 모듈 XSD 문서 처리
        for (const [moduleName, moduleDoc] of Object.entries(this.moduleXsdDocs)) {
            try {
                // GML 지오메트리 속성 찾기
                const geometryPropertyNodes = xpath.select('//xs:element[contains(@name, "geometry") or contains(@name, "Geometry")]', moduleDoc);
                for (const geometryNode of geometryPropertyNodes) {
                    const geometryElement = geometryNode;
                    const geometryName = geometryElement.getAttribute('name');
                    const geometryType = geometryElement.getAttribute('type');
                    if (!geometryName || !geometryType)
                        continue;
                    // 상위 복합 타입 찾기
                    let parentElement = geometryElement.parentNode;
                    let sourceTypeName = '';
                    while (parentElement) {
                        if (parentElement.nodeName === 'xs:complexType' && parentElement.getAttribute('name')) {
                            sourceTypeName = parentElement.getAttribute('name') || '';
                            break;
                        }
                        parentElement = parentElement.parentNode;
                    }
                    if (!sourceTypeName)
                        continue;
                    // 타입 처리
                    const typeParts = geometryType.split(':');
                    const typeWithoutPrefix = typeParts.length > 1 ? typeParts[1] : typeParts[0];
                    // 관계 ID 및 이름 생성
                    const relationshipId = `spatial_${sourceTypeName}_${geometryName}_${typeWithoutPrefix}`;
                    const relationshipName = `${sourceTypeName}_has_geometry_${typeWithoutPrefix}`;
                    // 공간 관계 유형 결정
                    let spatialType = SpatialRelationType.CONTAINS;
                    if (geometryName.includes('boundedBy')) {
                        spatialType = SpatialRelationType.WITHIN;
                    }
                    else if (geometryName.includes('touches')) {
                        spatialType = SpatialRelationType.TOUCHES;
                    }
                    else if (geometryName.includes('overlaps')) {
                        spatialType = SpatialRelationType.OVERLAPS;
                    }
                    // 관계 정보 생성
                    const relationship = {
                        id: relationshipId,
                        name: relationshipName,
                        type: RelationshipType.SPATIAL,
                        source: sourceTypeName,
                        target: typeWithoutPrefix,
                        sourceRole: sourceTypeName.toLowerCase(),
                        targetRole: geometryName,
                        sourceMultiplicity: { min: 1, max: 1 },
                        targetMultiplicity: { min: 0, max: 1 },
                        direction: RelationshipDirection.UNIDIRECTIONAL,
                        spatialType,
                        xsdPath: path.join(this.xsdBasePath, `${moduleName}.xsd`)
                    };
                    this.relationships.set(relationshipId, relationship);
                    logger.debug(`지오메트리 관계 추출: ${sourceTypeName} -> ${typeWithoutPrefix} (${spatialType})`);
                }
            }
            catch (error) {
                logger.error(`모듈 ${moduleName}에서 지오메트리 관계 추출 중 오류 발생`, error);
            }
        }
    }
    /**
     * 참조 무결성 규칙 추출
     */
    extractReferentialIntegrityRules() {
        logger.info('참조 무결성 규칙 추출 중...');
        // 각 모듈 XSD 문서 처리
        for (const [moduleName, moduleDoc] of Object.entries(this.moduleXsdDocs)) {
            try {
                // 키와 키 참조 요소 찾기
                const keyElements = xpath.select('//xs:key', moduleDoc);
                const keyrefElements = xpath.select('//xs:keyref', moduleDoc);
                // 키 요소 처리
                for (const keyElement of keyElements) {
                    this.processKeyElement(keyElement, moduleName);
                }
                // 키 참조 요소 처리
                for (const keyrefElement of keyrefElements) {
                    this.processKeyRefElement(keyrefElement, moduleName);
                }
            }
            catch (error) {
                logger.error(`모듈 ${moduleName}에서 참조 무결성 규칙 추출 중 오류 발생`, error);
            }
        }
        logger.info(`참조 무결성 규칙이 추출되었습니다.`);
    }
    /**
     * 키 요소 처리
     * @param keyElement - 키 요소
     * @param moduleName - 모듈 이름
     */
    processKeyElement(keyElement, moduleName) {
        const keyName = keyElement.getAttribute('name');
        if (!keyName)
            return;
        const selectorResult = xpath.select('./xs:selector', keyElement);
        if (!selectorResult || !Array.isArray(selectorResult) || selectorResult.length === 0)
            return;
        const selector = selectorResult[0];
        const fields = xpath.select('./xs:field', keyElement);
        if (!selector || !fields || fields.length === 0)
            return;
        const selectorPath = selector.getAttribute('xpath');
        const fieldPaths = fields.map((field) => field.getAttribute('xpath'));
        logger.debug(`키 규칙 발견: ${keyName} (${selectorPath}, ${fieldPaths.join(',')})`);
    }
    /**
     * 키 참조 요소 처리
     * @param keyrefElement - 키 참조 요소
     * @param moduleName - 모듈 이름
     */
    processKeyRefElement(keyrefElement, moduleName) {
        const keyrefName = keyrefElement.getAttribute('name');
        const refer = keyrefElement.getAttribute('refer');
        if (!keyrefName || !refer)
            return;
        const selectorResult = xpath.select('./xs:selector', keyrefElement);
        if (!selectorResult || !Array.isArray(selectorResult) || selectorResult.length === 0)
            return;
        const selector = selectorResult[0];
        const fields = xpath.select('./xs:field', keyrefElement);
        if (!selector || !fields || fields.length === 0)
            return;
        const selectorPath = selector.getAttribute('xpath');
        const fieldPaths = fields.map((field) => field.getAttribute('xpath'));
        logger.debug(`키 참조 규칙 발견: ${keyrefName} -> ${refer} (${selectorPath}, ${fieldPaths.join(',')})`);
    }
    /**
     * 특정 유형의 관계 개수 계산
     * @param type - 관계 유형
     * @returns 해당 유형의 관계 개수
     */
    countRelationshipsByType(type) {
        let count = 0;
        for (const relationship of this.relationships.values()) {
            if (relationship.type === type) {
                count++;
            }
        }
        return count;
    }
    /**
     * 관계 정보의 집합 반환
     * @returns 관계 정보 Map
     */
    getRelationships() {
        return this.relationships;
    }
    /**
     * 관계 정보의 배열 반환
     * @returns 관계 정보 배열
     */
    getRelationshipsArray() {
        return Array.from(this.relationships.values());
    }
    /**
     * 특정 유형의 관계 필터링하여 반환
     * @param type - 필터링할 관계 유형
     * @returns 필터링된 관계 정보 배열
     */
    getRelationshipsByType(type) {
        return this.getRelationshipsArray().filter(relationship => relationship.type === type);
    }
    /**
     * 특정 소스 객체의 관계 필터링하여 반환
     * @param sourceType - 소스 객체 타입 이름
     * @returns 필터링된 관계 정보 배열
     */
    getRelationshipsBySource(sourceType) {
        return this.getRelationshipsArray().filter(relationship => relationship.source === sourceType);
    }
    /**
     * 특정 대상 객체의 관계 필터링하여 반환
     * @param targetType - 대상 객체 타입 이름
     * @returns 필터링된 관계 정보 배열
     */
    getRelationshipsByTarget(targetType) {
        return this.getRelationshipsArray().filter(relationship => relationship.target === targetType);
    }
    /**
     * 개념 모델 설정 (index.ts와 호환되도록 추가)
     * @param conceptModel - 개념 모델
     */
    setConceptualModel(conceptModel) {
        this.conceptualModel = conceptModel;
        // 이미 설정된 개념 모델이 있으면 처리하지 않음
        if (this.conceptExtractor && this.objectExtractor) {
            return;
        }
        // 개념 추출기 생성 및 설정
        if (this.conceptExtractor === null) {
            const conceptExtractor = new ConceptExtractor(this.xsdBasePath);
            this.setConceptExtractor(conceptExtractor);
        }
        // 객체 추출기도 필요하다면 초기화
        if (this.objectExtractor === null) {
            const objectExtractor = new ObjectExtractor(this.xsdBasePath);
            this.setObjectExtractor(objectExtractor);
        }
    }
    /**
     * 모듈 간 관계 추출
     */
    extractModuleRelationships() {
        // 모듈 간 관계를 담을 객체
        const moduleRelationships = {
            dependencies: [],
            crossModuleAssociations: [],
            crossModuleGeneralizations: []
        };
        // 각 관계를 순회하면서 모듈 간 관계 찾기
        for (const relationship of this.getRelationshipsArray()) {
            // 두 객체의 모듈 찾기
            const sourceModule = this.findModuleForClass(relationship.source);
            const targetModule = this.findModuleForClass(relationship.target);
            // 서로 다른 모듈 간의 관계인 경우
            if (sourceModule && targetModule && sourceModule !== targetModule) {
                // 관계 유형에 따라 분류
                if (relationship.type === RelationshipType.ASSOCIATION) {
                    moduleRelationships.crossModuleAssociations.push({
                        source: sourceModule,
                        target: targetModule,
                        relationship: relationship.name
                    });
                }
                // 의존성 관계에 추가 (중복 제거)
                const dependencyExists = moduleRelationships.dependencies.some(dep => dep.source === sourceModule && dep.target === targetModule);
                if (!dependencyExists) {
                    moduleRelationships.dependencies.push({
                        source: sourceModule,
                        target: targetModule
                    });
                }
            }
        }
        return moduleRelationships;
    }
    /**
     * 관계의 다중성 분석
     */
    analyzeRelationshipMultiplicity() {
        const multiplicitySummary = {
            oneToOne: [],
            oneToMany: [],
            manyToOne: [],
            manyToMany: []
        };
        for (const relationship of this.getRelationshipsArray()) {
            // 다중성 분석
            const sourceMax = relationship.sourceMultiplicity.max;
            const targetMax = relationship.targetMultiplicity.max;
            // 다중성 유형 결정
            if (sourceMax === 1 && targetMax === 1) {
                multiplicitySummary.oneToOne.push(relationship);
            }
            else if (sourceMax === 1 && (targetMax === '*' || Number(targetMax) > 1)) {
                multiplicitySummary.oneToMany.push(relationship);
            }
            else if ((sourceMax === '*' || Number(sourceMax) > 1) && targetMax === 1) {
                multiplicitySummary.manyToOne.push(relationship);
            }
            else {
                multiplicitySummary.manyToMany.push(relationship);
            }
        }
        return multiplicitySummary;
    }
    /**
     * 특정 모듈의 관계 그래프 생성
     */
    createModuleRelationshipGraph(moduleName) {
        const graph = {
            nodes: [],
            edges: []
        };
        // 중심 모듈 노드 추가
        graph.nodes.push({
            id: moduleName,
            label: moduleName,
            type: 'module',
            isMainModule: true
        });
        // 모듈 관련 클래스 추가
        if (this.conceptExtractor && this.conceptualModel) {
            // 해당 모듈의 클래스 목록 가져오기
            const moduleClasses = [];
            for (const module of this.conceptualModel.modules) {
                if (module.name === moduleName) {
                    moduleClasses.push(...module.classes);
                    break;
                }
            }
            for (const cls of moduleClasses) {
                graph.nodes.push({
                    id: cls.name,
                    label: cls.name,
                    type: 'class',
                    module: moduleName
                });
                // 모듈과 클래스 간 엣지 추가
                graph.edges.push({
                    source: moduleName,
                    target: cls.name,
                    type: 'contains'
                });
            }
        }
        // 해당 모듈과 관련된 관계 추가
        for (const relationship of this.getRelationshipsArray()) {
            const sourceModule = this.findModuleForClass(relationship.source);
            const targetModule = this.findModuleForClass(relationship.target);
            if (sourceModule === moduleName || targetModule === moduleName) {
                // 소스 노드가 아직 그래프에 없으면 추가
                if (!graph.nodes.some((node) => node.id === relationship.source)) {
                    graph.nodes.push({
                        id: relationship.source,
                        label: relationship.source,
                        type: 'class',
                        module: sourceModule || 'external'
                    });
                }
                // 타겟 노드가 아직 그래프에 없으면 추가
                if (!graph.nodes.some((node) => node.id === relationship.target)) {
                    graph.nodes.push({
                        id: relationship.target,
                        label: relationship.target,
                        type: 'class',
                        module: targetModule || 'external'
                    });
                }
                // 관계 엣지 추가
                graph.edges.push({
                    source: relationship.source,
                    target: relationship.target,
                    type: relationship.type.toLowerCase(),
                    label: relationship.name
                });
            }
        }
        return graph;
    }
    /**
     * 클래스가 속한 모듈 찾기
     */
    findModuleForClass(className) {
        if (!this.conceptualModel)
            return null;
        for (const module of this.conceptualModel.modules) {
            if (module.classes.some(cls => cls.name === className)) {
                return module.name;
            }
        }
        return null;
    }
}
