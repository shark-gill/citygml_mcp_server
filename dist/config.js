/**
 * CityGML MCP 서버 설정
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// ESM에서 현재 디렉토리 가져오기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 프로젝트 루트 디렉토리
export const ROOT_DIR = path.join(__dirname, '..');
// XSD 스키마 디렉토리
export const XSD_DIR = path.join(ROOT_DIR, 'xsds');
// 개념 모델 문서 URL
export const CONCEPT_MODEL_URL = 'https://docs.ogc.org/is/20-010/20-010.html';
// 인코딩 문서 URL (임시, 실제 URL로 교체 필요)
export const ENCODING_URL = 'https://docs.ogc.org/is/20-010/006r2.html';
// 캐시 설정
export const CACHE_TTL = {
    MEMORY: 30 * 60 * 1000, // 30분
    DISK: 24 * 60 * 60 * 1000 // 24시간
};
// 모듈 네임스페이스 매핑
export const MODULE_NAMESPACES = {
    core: 'http://www.opengis.net/citygml/3.0',
    building: 'http://www.opengis.net/citygml/building/3.0',
    bridge: 'http://www.opengis.net/citygml/bridge/3.0',
    transportation: 'http://www.opengis.net/citygml/transportation/3.0',
    tunnel: 'http://www.opengis.net/citygml/tunnel/3.0',
    vegetation: 'http://www.opengis.net/citygml/vegetation/3.0',
    waterBody: 'http://www.opengis.net/citygml/waterbody/3.0',
    landUse: 'http://www.opengis.net/citygml/landuse/3.0',
    relief: 'http://www.opengis.net/citygml/relief/3.0',
    cityFurniture: 'http://www.opengis.net/citygml/cityfurniture/3.0',
    cityObjectGroup: 'http://www.opengis.net/citygml/cityobjectgroup/3.0',
    appearance: 'http://www.opengis.net/citygml/appearance/3.0',
    dynamizer: 'http://www.opengis.net/citygml/dynamizer/3.0',
    generics: 'http://www.opengis.net/citygml/generics/3.0',
    versioning: 'http://www.opengis.net/citygml/versioning/3.0',
    pointCloud: 'http://www.opengis.net/citygml/pointcloud/3.0'
};
// 서버 설정
export const SERVER_CONFIG = {
    name: 'CityGML-MCP-Server',
    version: '1.0.0',
    description: 'CityGML 3.0 Model Context Protocol Server'
};
// 사용 가능한 XSD 스키마 파일 목록 가져오기
export function getAvailableSchemas() {
    if (!fs.existsSync(XSD_DIR)) {
        console.warn(`XSD 디렉토리가 존재하지 않음: ${XSD_DIR}`);
        return [];
    }
    return fs.readdirSync(XSD_DIR)
        .filter(file => file.endsWith('.xsd'))
        .map(file => path.join(XSD_DIR, file));
}
// 모듈 이름에 해당하는 XSD 파일 경로 찾기
export function findSchemaForModule(moduleName) {
    const schemas = getAvailableSchemas();
    const lowerModuleName = moduleName.toLowerCase();
    // 정확한 이름 일치 먼저 시도
    const exactMatch = schemas.find(schema => {
        const fileName = path.basename(schema, '.xsd').toLowerCase();
        return fileName === lowerModuleName;
    });
    if (exactMatch) {
        return exactMatch;
    }
    // 부분 일치로 시도
    const partialMatch = schemas.find(schema => {
        const fileName = path.basename(schema, '.xsd').toLowerCase();
        return fileName.includes(lowerModuleName);
    });
    return partialMatch || null;
}
