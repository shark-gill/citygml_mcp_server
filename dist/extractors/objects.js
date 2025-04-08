import * as fs from 'fs';
import { DOMParser } from 'xmldom';
// @ts-ignore: xpath 모듈에 타입 정의가 없습니다
import * as xpath from 'xpath';
import { logger } from '../utils/logger.js';
// xpath.select의 결과가 노드 배열인지 확인하는 헬퍼 함수
function isNodeArray(obj) {
    return Array.isArray(obj) && obj.length > 0 && obj[0].nodeType !== undefined;
}
/**
 * CityGML 객체 추출기
 * 다양한 CityGML 객체 유형과 계층 구조, LOD 특성을 추출합니다.
 */
export class ObjectExtractor {
    constructor(xsdBasePath) {
        this.conceptualModel = null;
        // 주요 CityGML 모듈 이름
        this.cityObjectModules = [
            'building',
            'bridge',
            'transportation',
            'vegetation',
            'waterBody',
            'landUse',
            'cityFurniture',
            'relief',
            'tunnel'
        ];
        // 기하 객체 관련 클래스 이름 패턴
        this.geometryClassPatterns = [
            'Geometry',
            'Solid',
            'Surface',
            'Curve',
            'Point',
            'MultiSurface',
            'CompositeSurface',
            'MultiCurve',
            'CompositeCurve',
            'MultiPoint'
        ];
        this.xsdBasePath = xsdBasePath;
        this.domParser = new DOMParser();
    }
    /**
     * 개념 모델을 설정하여 객체 추출에 활용
     */
    setConceptualModel(model) {
        this.conceptualModel = model;
    }
    /**
     * CityGML의 모든 객체 유형을 추출
     */
    extractAllCityObjects() {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        const cityObjects = new Map();
        for (const module of this.conceptualModel.modules) {
            // CityGML 객체 모듈에서만 추출
            if (this.cityObjectModules.includes(module.name)) {
                const moduleObjects = this.extractCityObjectsFromModule(module);
                moduleObjects.forEach((object, name) => {
                    cityObjects.set(name, object);
                });
            }
        }
        // 객체 간 계층 구조 구축
        this.buildObjectHierarchy(cityObjects);
        return cityObjects;
    }
    /**
     * 특정 모듈에서 City 객체 추출
     */
    extractCityObjectsFromModule(module) {
        const objects = new Map();
        for (const classInfo of module.classes) {
            // AbstractObject를 상속받는 클래스만 CityObject로 간주
            const isAbstractClass = classInfo.isAbstract === true;
            const isCityObject = this.isCityObjectClass(classInfo);
            if (isCityObject) {
                const object = {
                    name: classInfo.name,
                    module: module.name,
                    isAbstract: isAbstractClass,
                    superClasses: classInfo.superClasses || [],
                    attributes: classInfo.attributes,
                    associations: classInfo.associations || [],
                    geometryProperties: this.extractGeometryProperties(classInfo),
                    lodInfo: this.extractLodInfo(classInfo),
                    thematicAttributes: this.extractThematicAttributes(classInfo)
                };
                objects.set(classInfo.name, object);
            }
        }
        return objects;
    }
    /**
     * 클래스가 CityObject인지 확인
     */
    isCityObjectClass(classInfo) {
        // 상위 클래스 중에 AbstractCityObject 또는 AbstractFeature가 있으면 CityObject
        if (classInfo.superClasses) {
            for (const superClass of classInfo.superClasses) {
                if (superClass.includes('AbstractCityObject') ||
                    superClass.includes('AbstractFeature') ||
                    superClass.includes('AbstractSpace') ||
                    superClass.includes('AbstractOccupiedSpace')) {
                    return true;
                }
            }
        }
        // 클래스 이름으로 판단 (이름에 특정 패턴이 있으면 CityObject)
        const cityObjectNamePatterns = [
            'Building', 'Bridge', 'Road', 'Railway', 'Square', 'Track',
            'Plant', 'SolitaryVegetationObject', 'PlantCover',
            'WaterBody', 'WaterSurface', 'LandUse', 'CityFurniture',
            'ReliefFeature', 'Tunnel'
        ];
        for (const pattern of cityObjectNamePatterns) {
            if (classInfo.name.includes(pattern)) {
                return true;
            }
        }
        return false;
    }
    /**
     * 기하 속성 추출
     */
    extractGeometryProperties(classInfo) {
        const geometryProperties = [];
        // 속성에서 기하 속성 추출
        for (const attribute of classInfo.attributes) {
            const isGeometryAttribute = this.geometryClassPatterns.some(pattern => attribute.type.includes(pattern));
            if (isGeometryAttribute) {
                geometryProperties.push({
                    name: attribute.name,
                    type: attribute.type,
                    cardinality: attribute.cardinality
                });
            }
        }
        // 연관관계에서 기하 속성 추출
        if (classInfo.associations) {
            for (const association of classInfo.associations) {
                const isGeometryAssociation = this.geometryClassPatterns.some(pattern => association.target.includes(pattern));
                if (isGeometryAssociation) {
                    geometryProperties.push({
                        name: association.name,
                        type: association.target,
                        cardinality: association.cardinality,
                        role: association.role
                    });
                }
            }
        }
        return geometryProperties;
    }
    /**
     * LOD 정보 추출
     */
    extractLodInfo(classInfo) {
        const lodInfo = {
            maxLod: 0,
            minLod: 0,
            lodAttributes: []
        };
        // 속성에서 LOD 정보 추출
        for (const attribute of classInfo.attributes) {
            // LOD 패턴 매칭
            if (attribute.name.match(/lod[0-9]/) || attribute.name.includes('LOD')) {
                const lodLevel = this.extractLodLevel(attribute.name);
                if (lodLevel > -1) {
                    if (lodLevel > lodInfo.maxLod) {
                        lodInfo.maxLod = lodLevel;
                    }
                    if (lodInfo.minLod === 0 || lodLevel < lodInfo.minLod) {
                        lodInfo.minLod = lodLevel;
                    }
                    lodInfo.lodAttributes.push({
                        name: attribute.name,
                        level: lodLevel,
                        type: attribute.type
                    });
                }
            }
        }
        // 연관관계에서 LOD 정보 추출
        if (classInfo.associations) {
            for (const association of classInfo.associations) {
                if (association.name.match(/lod[0-9]/) || association.name.includes('LOD')) {
                    const lodLevel = this.extractLodLevel(association.name);
                    if (lodLevel > -1) {
                        if (lodLevel > lodInfo.maxLod) {
                            lodInfo.maxLod = lodLevel;
                        }
                        if (lodInfo.minLod === 0 || lodLevel < lodInfo.minLod) {
                            lodInfo.minLod = lodLevel;
                        }
                        lodInfo.lodAttributes.push({
                            name: association.name,
                            level: lodLevel,
                            type: association.target,
                            role: association.role
                        });
                    }
                }
            }
        }
        return lodInfo;
    }
    /**
     * LOD 레벨 추출 - 속성 또는 연관 이름에서 숫자를 추출
     */
    extractLodLevel(name) {
        const match = name.match(/lod([0-9])/i);
        if (match && match[1]) {
            return parseInt(match[1], 10);
        }
        return -1;
    }
    /**
     * 주제별 속성 추출 (기하 속성이 아닌 일반 속성)
     */
    extractThematicAttributes(classInfo) {
        const thematicAttributes = [];
        // 기하 속성이 아닌 일반 속성 추출
        for (const attribute of classInfo.attributes) {
            const isGeometryAttribute = this.geometryClassPatterns.some(pattern => attribute.type.includes(pattern));
            const isLodAttribute = attribute.name.match(/lod[0-9]/) || attribute.name.includes('LOD');
            if (!isGeometryAttribute && !isLodAttribute) {
                thematicAttributes.push({
                    name: attribute.name,
                    type: attribute.type,
                    cardinality: attribute.cardinality
                });
            }
        }
        return thematicAttributes;
    }
    /**
     * 객체 계층 구조 구축 (상속 관계에 따른 계층 구조)
     */
    buildObjectHierarchy(objects) {
        for (const [objectName, object] of objects.entries()) {
            for (const [potentialChildName, potentialChild] of objects.entries()) {
                // 상위 클래스 중에 현재 객체가 있으면 자식으로 추가
                if (potentialChild.superClasses.includes(objectName)) {
                    if (!object.children) {
                        object.children = [];
                    }
                    object.children.push(potentialChildName);
                }
            }
        }
    }
    /**
     * 모듈별 객체 분류
     */
    classifyObjectsByModule() {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        const objectsByModule = {};
        for (const module of this.conceptualModel.modules) {
            if (this.cityObjectModules.includes(module.name)) {
                objectsByModule[module.name] = [];
                for (const classInfo of module.classes) {
                    if (this.isCityObjectClass(classInfo)) {
                        objectsByModule[module.name].push(classInfo.name);
                    }
                }
            }
        }
        return objectsByModule;
    }
    /**
     * 특정 CityObject에 대한 기하 표현 추출
     */
    extractGeometryRepresentations(cityObjectName) {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        // 대상 City 객체 클래스 찾기
        let targetClass = null;
        for (const module of this.conceptualModel.modules) {
            for (const classInfo of module.classes) {
                if (classInfo.name === cityObjectName) {
                    targetClass = classInfo;
                    break;
                }
            }
            if (targetClass)
                break;
        }
        if (!targetClass) {
            logger.warn(`'${cityObjectName}' 객체를 찾을 수 없습니다.`);
            return [];
        }
        const geometryRepresentations = [];
        // 속성에서 기하 표현 추출
        for (const attribute of targetClass.attributes) {
            const isGeometryAttribute = this.geometryClassPatterns.some(pattern => attribute.type.includes(pattern));
            if (isGeometryAttribute) {
                const lodLevel = this.extractLodLevel(attribute.name);
                geometryRepresentations.push({
                    type: attribute.type,
                    lodLevel: lodLevel > -1 ? lodLevel : 0,
                    multiplicity: attribute.cardinality,
                    dimension: this.inferGeometryDimension(attribute.type)
                });
            }
        }
        // 연관관계에서 기하 표현 추출
        if (targetClass.associations) {
            for (const association of targetClass.associations) {
                const isGeometryAssociation = this.geometryClassPatterns.some(pattern => association.target.includes(pattern));
                if (isGeometryAssociation) {
                    const lodLevel = this.extractLodLevel(association.name);
                    geometryRepresentations.push({
                        type: association.target,
                        lodLevel: lodLevel > -1 ? lodLevel : 0,
                        multiplicity: association.cardinality,
                        dimension: this.inferGeometryDimension(association.target)
                    });
                }
            }
        }
        return geometryRepresentations;
    }
    /**
     * 기하 타입에서 차원 추론
     */
    inferGeometryDimension(geometryType) {
        if (geometryType.includes('Solid')) {
            return 3;
        }
        else if (geometryType.includes('Surface') || geometryType.includes('Polygon')) {
            return 2;
        }
        else if (geometryType.includes('Curve') || geometryType.includes('Line')) {
            return 1;
        }
        else if (geometryType.includes('Point')) {
            return 0;
        }
        return -1; // 알 수 없는 차원
    }
    /**
     * XSD 파일 처리 - 직접 XSD에서 객체 정보 추출
     */
    async processXsdFile(xsdFilePath) {
        try {
            const fileContent = await fs.promises.readFile(xsdFilePath, 'utf-8');
            const xsdDoc = this.domParser.parseFromString(fileContent, 'application/xml');
            // 스키마 요소 찾기
            const schemaElements = xpath.select('//xs:schema', xsdDoc);
            if (!schemaElements || schemaElements.length === 0) {
                logger.warn(`스키마 요소를 찾을 수 없음: ${xsdFilePath}`);
                return;
            }
            // 복합 타입 요소 추출
            const complexTypeElements = xpath.select('//xs:complexType', xsdDoc);
            for (const complexTypeNode of complexTypeElements) {
                const complexTypeElement = complexTypeNode;
                const typeName = complexTypeElement.getAttribute('name');
                if (!typeName)
                    continue;
                // CityObject 관련 타입인지 확인
                if (this.isCityObjectTypeByName(typeName)) {
                    logger.info(`CityObject 타입 발견: ${typeName}`);
                    // 여기서 추가 처리 가능
                }
            }
        }
        catch (error) {
            logger.error(`XSD 파일 처리 중 오류 발생: ${xsdFilePath}`, error);
            throw error;
        }
    }
    /**
     * 타입 이름으로 CityObject 타입인지 확인
     */
    isCityObjectTypeByName(typeName) {
        const cityObjectTypePatterns = [
            'AbstractCityObject',
            'AbstractFeature',
            'AbstractSpace',
            'AbstractOccupiedSpace',
            'Building',
            'Bridge',
            'Transportation',
            'Vegetation',
            'WaterBody',
            'LandUse',
            'CityFurniture',
            'Relief',
            'Tunnel'
        ];
        for (const pattern of cityObjectTypePatterns) {
            if (typeName.includes(pattern)) {
                return true;
            }
        }
        return false;
    }
}
export default ObjectExtractor;
