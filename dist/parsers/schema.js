/**
 * CityGML 3.0 XSD 스키마 파서
 */
import fs from 'fs';
import path from 'path';
import { parseXsdSchema } from '../utils/xml.js';
import { getAvailableSchemas, XSD_DIR, MODULE_NAMESPACES } from '../config.js';
import { getMemoryCache, setMemoryCache, getDiskCache, setDiskCache } from '../utils/cache.js';
import { CACHE_TTL } from '../config.js';
// 캐시 키
const SCHEMA_REGISTRY_CACHE_KEY = 'citygml3_schema_registry';
/**
 * 모든 CityGML 3.0 XSD 스키마 파일을 로드하고 파싱
 * @returns 스키마 레지스트리
 */
export async function loadAllSchemas() {
    // 메모리 캐시 확인
    const memCache = getMemoryCache(SCHEMA_REGISTRY_CACHE_KEY);
    if (memCache) {
        console.log('메모리 캐시에서 스키마 레지스트리 로드됨');
        return memCache;
    }
    // 디스크 캐시 확인
    const diskCache = getDiskCache(SCHEMA_REGISTRY_CACHE_KEY);
    if (diskCache) {
        console.log('디스크 캐시에서 스키마 레지스트리 로드됨');
        setMemoryCache(SCHEMA_REGISTRY_CACHE_KEY, diskCache, CACHE_TTL.MEMORY);
        return diskCache;
    }
    console.log('모든 XSD 스키마 파일 로드 중...');
    // 스키마 레지스트리 초기화
    const registry = {
        schemas: {},
        elementsByName: {},
        typesByName: {},
        moduleToNamespace: { ...MODULE_NAMESPACES }
    };
    // 사용 가능한 모든 스키마 파일 가져오기
    const schemaFiles = getAvailableSchemas();
    // 각 스키마 파일 처리
    for (const schemaFile of schemaFiles) {
        const schema = await loadSchema(schemaFile);
        // 네임스페이스별 스키마 그룹화
        if (!registry.schemas[schema.targetNamespace]) {
            registry.schemas[schema.targetNamespace] = [];
        }
        registry.schemas[schema.targetNamespace].push(schema);
        // 요소 인덱싱
        for (const element of schema.elements) {
            if (!registry.elementsByName[element.name]) {
                registry.elementsByName[element.name] = [];
            }
            registry.elementsByName[element.name].push(element);
        }
        // 타입 인덱싱
        for (const type of [...schema.complexTypes, ...schema.simpleTypes]) {
            if (type.name) {
                if (!registry.typesByName[type.name]) {
                    registry.typesByName[type.name] = [];
                }
                registry.typesByName[type.name].push(type);
            }
        }
    }
    // 모듈 이름과 네임스페이스 매핑 구성
    for (const namespace in registry.schemas) {
        const moduleName = getModuleNameFromNamespace(namespace);
        if (moduleName) {
            registry.moduleToNamespace[moduleName] = namespace;
        }
    }
    // 캐시에 저장
    setMemoryCache(SCHEMA_REGISTRY_CACHE_KEY, registry, CACHE_TTL.MEMORY);
    setDiskCache(SCHEMA_REGISTRY_CACHE_KEY, registry, CACHE_TTL.DISK);
    return registry;
}
/**
 * 단일 스키마 파일 로드 및 파싱
 * @param schemaFile 스키마 파일 경로
 * @returns 파싱된 스키마 문서
 */
export async function loadSchema(schemaFile) {
    const fileName = path.basename(schemaFile);
    const cacheKey = `schema_${fileName}`;
    // 메모리 캐시 확인
    const memCache = getMemoryCache(cacheKey);
    if (memCache) {
        return memCache;
    }
    // 디스크 캐시 확인
    const diskCache = getDiskCache(cacheKey);
    if (diskCache) {
        setMemoryCache(cacheKey, diskCache, CACHE_TTL.MEMORY);
        return diskCache;
    }
    console.log(`스키마 파일 로드 중: ${fileName}`);
    try {
        // 파일 읽기
        const content = await fs.promises.readFile(schemaFile, 'utf8');
        // 스키마 파싱
        const schema = parseXsdSchema(content, fileName);
        // 캐시에 저장
        setMemoryCache(cacheKey, schema, CACHE_TTL.MEMORY);
        setDiskCache(cacheKey, schema, CACHE_TTL.DISK);
        return schema;
    }
    catch (error) {
        console.error(`스키마 파일 로드 실패: ${fileName}`, error);
        throw new Error(`스키마 파일 로드 실패: ${fileName} - ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * 특정 모듈의 스키마 로드
 * @param moduleName 모듈 이름(예: 'building', 'transportation')
 * @returns 파싱된 스키마 문서
 */
export async function loadModuleSchema(moduleName) {
    // XSD 파일 이름 패턴(일반적으로 모듈 이름과 일치함)
    const expectedFileName = `${moduleName.toLowerCase()}.xsd`;
    const expectedFilePath = path.join(XSD_DIR, expectedFileName);
    // 파일이 존재하는지 확인
    if (fs.existsSync(expectedFilePath)) {
        return loadSchema(expectedFilePath);
    }
    // 파일이 없으면 이름 패턴으로 검색
    const schemaFiles = getAvailableSchemas();
    for (const schemaFile of schemaFiles) {
        const fileName = path.basename(schemaFile).toLowerCase();
        // 모듈 이름이 파일 이름에 포함되어 있는지 확인
        if (fileName.includes(moduleName.toLowerCase())) {
            return loadSchema(schemaFile);
        }
    }
    console.warn(`모듈 "${moduleName}"에 대한 스키마 파일을 찾을 수 없음`);
    return null;
}
/**
 * 네임스페이스에서 모듈 이름 추출
 * @param namespace 네임스페이스 URI
 * @returns 모듈 이름 또는 null
 */
function getModuleNameFromNamespace(namespace) {
    // CityGML 네임스페이스 패턴: http://www.opengis.net/citygml/{module}/3.0
    const match = namespace.match(/citygml\/([a-zA-Z0-9]+)\/3\.0/);
    if (match && match[1]) {
        return match[1];
    }
    // 코어 네임스페이스: http://www.opengis.net/citygml/3.0
    if (namespace === 'http://www.opengis.net/citygml/3.0') {
        return 'core';
    }
    return null;
}
