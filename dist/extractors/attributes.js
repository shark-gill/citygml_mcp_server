import { DOMParser } from 'xmldom';
/**
 * CityGML 속성 추출기
 * 객체 유형별 속성 정보, 속성 유형, 카디널리티, 코드 리스트 등을 추출합니다.
 */
export class AttributeExtractor {
    constructor(xsdBasePath) {
        this.conceptualModel = null;
        this.cityObjects = null;
        this.attributes = [];
        this.codelists = new Map();
        this.enumerations = new Map();
        this.constraints = [];
        this.metadataAttributes = [];
        this.attributesByObject = new Map();
        this.typeDistribution = {};
        // 메타데이터 관련 속성 이름 패턴
        this.metadataAttributePatterns = [
            'creationDate',
            'terminationDate',
            'validFrom',
            'validTo',
            'updateDate',
            'source',
            'creator',
            'description',
            'identifier'
        ];
        this.xsdBasePath = xsdBasePath;
        this.domParser = new DOMParser();
    }
    /**
     * 개념 모델을 설정하여 속성 추출에 활용
     */
    setConceptualModel(model) {
        this.conceptualModel = model;
    }
    /**
     * 모든 객체 유형의 속성 정보 추출
     */
    extractAllAttributes() {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        const allAttributes = new Map();
        // 모든 모듈에서 클래스(객체 유형) 속성 추출
        for (const module of this.conceptualModel.modules) {
            for (const classInfo of module.classes) {
                const attributes = this.extractClassAttributes(classInfo);
                allAttributes.set(classInfo.name, attributes);
            }
        }
        return allAttributes;
    }
    /**
     * 특정 클래스(객체 유형)의 속성 정보 추출
     */
    extractClassAttributes(classInfo) {
        const result = {
            className: classInfo.name,
            basicAttributes: [],
            geometryAttributes: [],
            metadataAttributes: [],
            codelistAttributes: [],
            enumerationAttributes: [],
            constrainedAttributes: []
        };
        // 모든 속성 처리
        for (const attribute of classInfo.attributes) {
            const attributeInfo = {
                name: attribute.name,
                type: attribute.type,
                cardinality: attribute.cardinality,
                description: attribute.description || '',
                isNillable: attribute.isNillable || false
            };
            // 속성 분류
            if (this.isGeometryAttribute(attribute.type)) {
                result.geometryAttributes.push(attributeInfo);
            }
            else if (this.isMetadataAttribute(attribute.name)) {
                result.metadataAttributes.push(attributeInfo);
            }
            else if (this.isCodelistAttribute(attribute.type)) {
                const codelistInfo = this.getCodelistInfo(attribute.type);
                result.codelistAttributes.push({
                    ...attributeInfo,
                    codelist: codelistInfo
                });
            }
            else if (this.isEnumerationAttribute(attribute.type)) {
                const enumInfo = this.getEnumerationInfo(attribute.type);
                result.enumerationAttributes.push({
                    ...attributeInfo,
                    enumeration: enumInfo
                });
            }
            else {
                result.basicAttributes.push(attributeInfo);
            }
            // 제약조건을 가진 속성 확인
            if (this.hasConstraints(classInfo, attribute.name)) {
                result.constrainedAttributes.push({
                    ...attributeInfo,
                    constraints: this.getAttributeConstraints(classInfo, attribute.name)
                });
            }
        }
        return result;
    }
    /**
     * 기하 관련 속성인지 확인
     */
    isGeometryAttribute(type) {
        const geometryTypePatterns = [
            'Geometry',
            'Point',
            'Curve',
            'Surface',
            'Solid',
            'GeometryProperty',
            'MultiPoint',
            'MultiCurve',
            'MultiSurface',
            'MultiSolid',
            'CompositeCurve',
            'CompositeSurface',
            'CompositeSolid'
        ];
        return geometryTypePatterns.some(pattern => type.includes(pattern));
    }
    /**
     * 메타데이터 관련 속성인지 확인
     */
    isMetadataAttribute(name) {
        return this.metadataAttributePatterns.some(pattern => name.includes(pattern));
    }
    /**
     * 코드 리스트 속성인지 확인
     */
    isCodelistAttribute(type) {
        if (!this.conceptualModel)
            return false;
        // 모든 모듈에서 코드리스트 확인
        for (const module of this.conceptualModel.modules) {
            if (module.codelists) {
                for (const codelist of module.codelists) {
                    // 타입이 코드리스트 이름과 일치하는지 확인
                    if (type.includes(codelist.name)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    /**
     * 열거형 속성인지 확인
     */
    isEnumerationAttribute(type) {
        if (!this.conceptualModel)
            return false;
        // 모든 모듈에서 열거형 확인
        for (const module of this.conceptualModel.modules) {
            if (module.enumerations) {
                for (const enumeration of module.enumerations) {
                    // 타입이 열거형 이름과 일치하는지 확인
                    if (type.includes(enumeration.name)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    /**
     * 코드 리스트 정보 가져오기
     */
    getCodelistInfo(type) {
        if (!this.conceptualModel)
            return null;
        // 모든 모듈에서 코드리스트 검색
        for (const module of this.conceptualModel.modules) {
            if (module.codelists) {
                for (const codelist of module.codelists) {
                    if (type.includes(codelist.name)) {
                        return codelist;
                    }
                }
            }
        }
        return null;
    }
    /**
     * 열거형 정보 가져오기
     */
    getEnumerationInfo(type) {
        if (!this.conceptualModel)
            return null;
        // 모든 모듈에서 열거형 검색
        for (const module of this.conceptualModel.modules) {
            if (module.enumerations) {
                for (const enumeration of module.enumerations) {
                    if (type.includes(enumeration.name)) {
                        return enumeration;
                    }
                }
            }
        }
        return null;
    }
    /**
     * 속성에 제약조건이 있는지 확인
     */
    hasConstraints(classInfo, attributeName) {
        if (!classInfo.constraints)
            return false;
        return classInfo.constraints.some(constraint => constraint.description.includes(attributeName));
    }
    /**
     * 속성의 제약조건 가져오기
     */
    getAttributeConstraints(classInfo, attributeName) {
        if (!classInfo.constraints)
            return [];
        return classInfo.constraints
            .filter((constraint) => constraint.description.includes(attributeName))
            .map((constraint) => ({
            name: constraint.name,
            description: constraint.description,
            expression: constraint.expression
        }));
    }
    /**
     * 모든 코드 리스트 추출
     */
    extractAllCodelists() {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        const allCodelists = [];
        // 모든 모듈에서 코드리스트 수집
        for (const module of this.conceptualModel.modules) {
            if (module.codelists) {
                allCodelists.push(...module.codelists);
            }
        }
        return allCodelists;
    }
    /**
     * 모든 열거형 추출
     */
    extractAllEnumerations() {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        const allEnumerations = [];
        // 모든 모듈에서 열거형 수집
        for (const module of this.conceptualModel.modules) {
            if (module.enumerations) {
                allEnumerations.push(...module.enumerations);
            }
        }
        return allEnumerations;
    }
    /**
     * 속성의 카디널리티(다중성) 정보 분석
     */
    analyzeCardinality() {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        const cardinalitySummary = {
            requiredAttributes: [],
            optionalAttributes: [],
            multiValuedAttributes: []
        };
        // 모든 클래스의 속성 카디널리티 분석
        for (const module of this.conceptualModel.modules) {
            for (const classInfo of module.classes) {
                for (const attribute of classInfo.attributes) {
                    const cardinality = attribute.cardinality;
                    // 필수 속성 (최소 출현이 1 이상)
                    if (cardinality.startsWith('1') || cardinality.startsWith('2') || cardinality.startsWith('3')) {
                        cardinalitySummary.requiredAttributes.push({
                            className: classInfo.name,
                            attributeName: attribute.name
                        });
                    }
                    // 선택 속성 (최소 출현이 0)
                    else if (cardinality.startsWith('0')) {
                        cardinalitySummary.optionalAttributes.push({
                            className: classInfo.name,
                            attributeName: attribute.name
                        });
                    }
                    // 다중값 속성 (최대 출현이 1보다 큼)
                    const maxOccurs = cardinality.split('..')[1];
                    if (maxOccurs === '*' || (maxOccurs && parseInt(maxOccurs) > 1)) {
                        cardinalitySummary.multiValuedAttributes.push({
                            className: classInfo.name,
                            attributeName: attribute.name,
                            maxOccurs
                        });
                    }
                }
            }
        }
        return cardinalitySummary;
    }
    /**
     * 메타데이터 속성 추출
     */
    extractMetadataAttributes() {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        const metadataByClass = new Map();
        // 모든 클래스에서 메타데이터 속성 추출
        for (const module of this.conceptualModel.modules) {
            for (const classInfo of module.classes) {
                const metadataAttributes = classInfo.attributes.filter(attribute => this.isMetadataAttribute(attribute.name));
                if (metadataAttributes.length > 0) {
                    metadataByClass.set(classInfo.name, metadataAttributes);
                }
            }
        }
        return metadataByClass;
    }
    /**
     * 특정 코드 리스트의 값 추출
     */
    getCodeListValues(codelistName) {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        // 모든 모듈에서 코드리스트 검색
        for (const module of this.conceptualModel.modules) {
            if (module.codelists) {
                const codelist = module.codelists.find((cl) => cl.name === codelistName);
                if (codelist) {
                    return codelist.values;
                }
            }
        }
        return [];
    }
    /**
     * 특정 열거형의 값 추출
     */
    getEnumerationValues(enumName) {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        // 모든 모듈에서 열거형 검색
        for (const module of this.conceptualModel.modules) {
            if (module.enumerations) {
                const enumeration = module.enumerations.find((en) => en.name === enumName);
                if (enumeration) {
                    return enumeration.values;
                }
            }
        }
        return [];
    }
    /**
     * 속성 제약조건 분석
     */
    analyzeAttributeConstraints() {
        if (!this.conceptualModel) {
            throw new Error('개념 모델이 설정되지 않았습니다. setConceptualModel()을 먼저 호출하세요.');
        }
        const constraintsSummary = {
            valueConstraints: [],
            typeConstraints: [],
            referentialConstraints: []
        };
        // 모든 클래스의 제약조건 분석
        for (const module of this.conceptualModel.modules) {
            for (const classInfo of module.classes) {
                if (classInfo.constraints) {
                    for (const constraint of classInfo.constraints) {
                        const desc = constraint.description.toLowerCase();
                        // 값 제약조건
                        if (desc.includes('value') || desc.includes('must be') || desc.includes('should be')) {
                            constraintsSummary.valueConstraints.push({
                                className: classInfo.name,
                                constraintName: constraint.name,
                                description: constraint.description
                            });
                        }
                        // 타입 제약조건
                        else if (desc.includes('type') || desc.includes('instance of')) {
                            constraintsSummary.typeConstraints.push({
                                className: classInfo.name,
                                constraintName: constraint.name,
                                description: constraint.description
                            });
                        }
                        // 참조 무결성 제약조건
                        else if (desc.includes('reference') || desc.includes('refers to')) {
                            constraintsSummary.referentialConstraints.push({
                                className: classInfo.name,
                                constraintName: constraint.name,
                                description: constraint.description
                            });
                        }
                    }
                }
            }
        }
        return constraintsSummary;
    }
}
export default AttributeExtractor;
