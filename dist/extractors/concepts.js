import * as path from 'path';
import { DOMParser } from 'xmldom';
// @ts-ignore: xpath 모듈에 타입 정의가 없습니다
import * as xpath from 'xpath';
import * as fsPromises from 'fs/promises';
// XML 네임스페이스 매핑
const namespaces = {
    xs: 'http://www.w3.org/2001/XMLSchema',
    gml: 'http://www.opengis.net/gml/3.2',
    core: 'http://www.opengis.net/citygml/3.0',
    gen: 'http://www.opengis.net/citygml/generics/3.0',
    xlink: 'http://www.w3.org/1999/xlink',
    bldg: 'http://www.opengis.net/citygml/building/3.0',
    brid: 'http://www.opengis.net/citygml/bridge/3.0',
    tran: 'http://www.opengis.net/citygml/transportation/3.0',
    tun: 'http://www.opengis.net/citygml/tunnel/3.0',
    veg: 'http://www.opengis.net/citygml/vegetation/3.0',
    wtr: 'http://www.opengis.net/citygml/waterbody/3.0',
    luse: 'http://www.opengis.net/citygml/landuse/3.0',
    dem: 'http://www.opengis.net/citygml/relief/3.0',
    frn: 'http://www.opengis.net/citygml/cityfurniture/3.0',
    grp: 'http://www.opengis.net/citygml/cityobjectgroup/3.0',
    app: 'http://www.opengis.net/citygml/appearance/3.0',
    dyn: 'http://www.opengis.net/citygml/dynamizer/3.0',
    vers: 'http://www.opengis.net/citygml/versioning/3.0',
    pcl: 'http://www.opengis.net/citygml/pointcloud/3.0',
    con: 'http://www.opengis.net/citygml/construction/3.0'
};
// XPath 선택함수 - 네임스페이스 적용
const select = xpath.useNamespaces(namespaces);
/**
 * CityGML 3.0의 개념 모델에서 핵심 개념들을 추출하는 클래스
 */
export class ConceptExtractor {
    constructor(xsdBasePath) {
        this.xsdBasePath = xsdBasePath;
        this.domParser = new DOMParser();
        this.conceptModel = {
            version: '3.0.0',
            modules: []
        };
    }
    /**
     * XSD 파일에서 모든 모듈 정보를 추출
     */
    async extractAllModules() {
        try {
            // 최상위 CityGML.xsd 파일부터 시작
            const cityGmlXsdPath = path.join(this.xsdBasePath, 'CityGML.xsd');
            const mainXsdContent = await fsPromises.readFile(cityGmlXsdPath, 'utf-8');
            const mainXsdDoc = this.domParser.parseFromString(mainXsdContent);
            // 모든 import 요소 추출하여 모듈 정의
            const imports = select('//xs:import', mainXsdDoc);
            // 각 모듈 파일 처리
            for (const importEl of imports) {
                const schemaLocation = importEl.getAttribute('schemaLocation');
                if (schemaLocation) {
                    const moduleName = path.basename(schemaLocation, '.xsd');
                    await this.processModuleFile(moduleName, schemaLocation);
                }
            }
            return this.conceptModel;
        }
        catch (error) {
            console.error('모듈 추출 중 오류:', error);
            throw error;
        }
    }
    /**
     * 개별 모듈 XSD 파일 처리
     */
    async processModuleFile(moduleName, schemaLocation) {
        try {
            const moduleXsdPath = path.join(this.xsdBasePath, schemaLocation);
            const moduleXsdContent = await fsPromises.readFile(moduleXsdPath, 'utf-8');
            const moduleXsdDoc = this.domParser.parseFromString(moduleXsdContent);
            // 네임스페이스 정보 추출
            const schemaElements = select('//xs:schema', moduleXsdDoc);
            if (schemaElements.length === 0) {
                console.warn(`${moduleName} 모듈에서 스키마 요소를 찾을 수 없습니다.`);
                return;
            }
            const schemaElement = schemaElements[0];
            const targetNamespace = schemaElement.getAttribute('targetNamespace');
            // 모듈 정보 생성
            const module = {
                name: moduleName,
                namespace: targetNamespace || '',
                description: this.extractModuleDescription(moduleXsdDoc),
                classes: this.extractClasses(moduleXsdDoc, moduleName),
                codelists: this.extractCodelists(moduleXsdDoc, moduleName),
                enumerations: this.extractEnumerations(moduleXsdDoc, moduleName),
                dependencies: this.extractDependencies(moduleXsdDoc)
            };
            this.conceptModel.modules.push(module);
        }
        catch (error) {
            console.error(`모듈 ${moduleName} 처리 중 오류:`, error);
        }
    }
    /**
     * 모듈에서 클래스 정보 추출
     */
    extractClasses(doc, moduleName) {
        const classes = [];
        // complexType 요소 추출 (클래스에 해당)
        const complexTypes = select('//xs:complexType', doc);
        for (const complexType of complexTypes) {
            const name = complexType.getAttribute('name');
            if (name) {
                // 클래스 정보 생성
                const classInfo = {
                    name,
                    description: this.extractDocumentation(complexType),
                    module: moduleName,
                    isAbstract: complexType.getAttribute('abstract') === 'true',
                    attributes: this.extractAttributes(complexType),
                    associations: this.extractAssociations(complexType),
                    constraints: this.extractConstraints(complexType),
                    superClasses: this.extractSuperClasses(complexType)
                };
                classes.push(classInfo);
            }
        }
        return classes;
    }
    /**
     * 모듈에서 코드 리스트 추출
     */
    extractCodelists(doc, moduleName) {
        const codelists = [];
        // simpleType에서 enumeration이 있는 요소 추출
        const simpleTypes = select('//xs:simpleType[.//xs:enumeration]', doc);
        for (const simpleType of simpleTypes) {
            const name = simpleType.getAttribute('name');
            if (name && !name.endsWith('EnumBase')) {
                const values = select('.//xs:enumeration', simpleType);
                const codelistInfo = {
                    name,
                    description: this.extractDocumentation(simpleType),
                    values: values.map(value => ({
                        code: value.getAttribute('value') || '',
                        description: this.extractDocumentation(value)
                    }))
                };
                codelists.push(codelistInfo);
            }
        }
        return codelists;
    }
    /**
     * 모듈에서 열거형 추출
     */
    extractEnumerations(doc, moduleName) {
        const enumerations = [];
        // simpleType에서 enumeration이 있고 이름이 EnumBase로 끝나는 요소 추출
        const simpleTypes = select('//xs:simpleType[.//xs:enumeration and contains(@name, "EnumBase")]', doc);
        for (const simpleType of simpleTypes) {
            const name = simpleType.getAttribute('name');
            if (name) {
                const values = select('.//xs:enumeration', simpleType);
                const enumInfo = {
                    name,
                    description: this.extractDocumentation(simpleType),
                    values: values.map(value => ({
                        name: value.getAttribute('value') || '',
                        description: this.extractDocumentation(value)
                    }))
                };
                enumerations.push(enumInfo);
            }
        }
        return enumerations;
    }
    /**
     * 모듈 의존성 추출
     */
    extractDependencies(doc) {
        const dependencies = [];
        // 모든 import 요소에서 의존성 추출
        const imports = select('//xs:import', doc);
        for (const importEl of imports) {
            const schemaLocation = importEl.getAttribute('schemaLocation');
            if (schemaLocation) {
                const dependency = path.basename(schemaLocation, '.xsd');
                dependencies.push(dependency);
            }
        }
        return dependencies;
    }
    /**
     * 클래스에서 속성 추출
     */
    extractAttributes(complexType) {
        const attributes = [];
        // 요소 추출
        const elements = select('.//xs:element', complexType);
        for (const element of elements) {
            const name = element.getAttribute('name');
            const type = element.getAttribute('type');
            if (name && type) {
                // 다중성 분석
                const minOccurs = element.getAttribute('minOccurs') || '1';
                const maxOccurs = element.getAttribute('maxOccurs') || '1';
                const attribute = {
                    name,
                    type: type.split(':').pop() || type, // 네임스페이스 제거
                    cardinality: maxOccurs === 'unbounded' ? `${minOccurs}..*` : `${minOccurs}..${maxOccurs}`,
                    isNillable: element.getAttribute('nillable') === 'true',
                    description: this.extractDocumentation(element)
                };
                attributes.push(attribute);
            }
        }
        // 속성 추출
        const attrElements = select('.//xs:attribute', complexType);
        for (const attrElement of attrElements) {
            const name = attrElement.getAttribute('name');
            const type = attrElement.getAttribute('type');
            if (name && type) {
                const attribute = {
                    name,
                    type: type.split(':').pop() || type, // 네임스페이스 제거
                    cardinality: attrElement.getAttribute('use') === 'required' ? '1..1' : '0..1',
                    isNillable: false,
                    description: this.extractDocumentation(attrElement)
                };
                attributes.push(attribute);
            }
        }
        return attributes;
    }
    /**
     * 클래스에서 연관관계 추출
     */
    extractAssociations(complexType) {
        const associations = [];
        // 참조 요소(ref 속성이 있는)를 통한 연관관계 추출
        const refElements = select('.//xs:element[@ref]', complexType);
        for (const refElement of refElements) {
            const ref = refElement.getAttribute('ref');
            if (ref) {
                // 네임스페이스 접두사 처리
                const refName = ref.split(':').pop() || ref;
                // 다중성 분석
                const minOccurs = refElement.getAttribute('minOccurs') || '1';
                const maxOccurs = refElement.getAttribute('maxOccurs') || '1';
                const association = {
                    name: refName,
                    target: refName,
                    cardinality: maxOccurs === 'unbounded' ? `${minOccurs}..*` : `${minOccurs}..${maxOccurs}`,
                    role: refName,
                    description: this.extractDocumentation(refElement)
                };
                associations.push(association);
            }
        }
        return associations;
    }
    /**
     * 요소에서 제약조건 추출
     */
    extractConstraints(complexType) {
        const constraints = [];
        // 주석에서 제약조건 추출
        // 일반적으로 주석에 제약조건이 텍스트로 포함됨
        const annotations = select('.//xs:annotation', complexType);
        for (const annotation of annotations) {
            const documentation = select('.//xs:documentation', annotation);
            for (const doc of documentation) {
                const content = doc.textContent || '';
                // 제약조건 관련 키워드 확인
                if (content.includes('constraint') || content.includes('restriction') ||
                    content.includes('must') || content.includes('should')) {
                    constraints.push({
                        name: 'Constraint',
                        description: content,
                        expression: '' // XSD에서는 일반적으로 표현식이 없음
                    });
                }
            }
        }
        return constraints;
    }
    /**
     * 클래스의 상위 클래스 추출
     */
    extractSuperClasses(complexType) {
        const superClasses = [];
        // extension 요소 찾기
        const extensions = select('.//xs:extension', complexType);
        for (const extension of extensions) {
            const base = extension.getAttribute('base');
            if (base) {
                // 네임스페이스 접두사 처리
                const baseClass = base.split(':').pop() || base;
                superClasses.push(baseClass);
            }
        }
        return superClasses;
    }
    /**
     * 모듈 설명 추출
     */
    extractModuleDescription(doc) {
        // 모듈 설명은 주로 최상위 주석에 있음
        const annotations = select('//xs:annotation', doc);
        if (annotations && annotations.length > 0) {
            const documentation = select('.//xs:documentation', annotations[0]);
            if (documentation && documentation.length > 0) {
                return documentation[0].textContent || '';
            }
        }
        return '';
    }
    /**
     * 요소에서 문서화(설명) 추출
     */
    extractDocumentation(element) {
        const annotations = select('.//xs:annotation', element);
        if (annotations && annotations.length > 0) {
            const documentation = select('.//xs:documentation', annotations[0]);
            if (documentation && documentation.length > 0) {
                return documentation[0].textContent || '';
            }
        }
        return '';
    }
    /**
     * 개념 모델과 문서 섹션 매핑
     */
    mapConceptsToDocSections(docSectionMap) {
        const conceptSectionMap = new Map();
        // 각 모듈과 클래스에 대한 문서 섹션 매핑
        for (const module of this.conceptModel.modules) {
            for (const classInfo of module.classes) {
                // 클래스 이름으로 문서 섹션 찾기
                const sectionKey = Object.keys(docSectionMap).find(key => classInfo.name.includes(key) || key.includes(classInfo.name));
                if (sectionKey) {
                    const sectionInfo = {
                        id: docSectionMap[sectionKey],
                        title: sectionKey,
                        content: classInfo.description || '',
                        conceptName: classInfo.name,
                        conceptType: 'class',
                        moduleName: module.name,
                        sectionTitle: sectionKey,
                        sectionId: docSectionMap[sectionKey],
                        summary: classInfo.description
                    };
                    conceptSectionMap.set(classInfo.name, sectionInfo);
                }
            }
            // 코드 리스트와 열거형에도 동일한 매핑 적용
            if (module.codelists) {
                for (const codelist of module.codelists) {
                    const sectionKey = Object.keys(docSectionMap).find(key => codelist.name.includes(key) || key.includes(codelist.name));
                    if (sectionKey) {
                        const sectionInfo = {
                            id: docSectionMap[sectionKey],
                            title: sectionKey,
                            content: codelist.description || '',
                            conceptName: codelist.name,
                            conceptType: 'codelist',
                            moduleName: module.name,
                            sectionTitle: sectionKey,
                            sectionId: docSectionMap[sectionKey],
                            summary: codelist.description
                        };
                        conceptSectionMap.set(codelist.name, sectionInfo);
                    }
                }
            }
            if (module.enumerations) {
                for (const enumeration of module.enumerations) {
                    const sectionKey = Object.keys(docSectionMap).find(key => enumeration.name.includes(key) || key.includes(enumeration.name));
                    if (sectionKey) {
                        const sectionInfo = {
                            id: docSectionMap[sectionKey],
                            title: sectionKey,
                            content: enumeration.description || '',
                            conceptName: enumeration.name,
                            conceptType: 'enumeration',
                            moduleName: module.name,
                            sectionTitle: sectionKey,
                            sectionId: docSectionMap[sectionKey],
                            summary: enumeration.description
                        };
                        conceptSectionMap.set(enumeration.name, sectionInfo);
                    }
                }
            }
        }
        return conceptSectionMap;
    }
}
export default ConceptExtractor;
