import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { ConceptExtractor } from '../dist/extractors/concepts.js';
import { ObjectExtractor } from '../dist/extractors/objects.js';

// ES 모듈에서 __dirname을 사용하기 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// XSD 파일 경로
const XSD_BASE_PATH = path.join(__dirname, '..', 'xsds');

/**
 * 객체 추출기 기본 테스트
 */
async function testObjectExtractor() {
  console.log('======== 객체 추출기 테스트 시작 ========');
  
  try {
    // XSD 디렉토리 확인
    if (!fs.existsSync(XSD_BASE_PATH)) {
      console.error(`오류: XSD 디렉토리가 존재하지 않습니다. 경로: ${XSD_BASE_PATH}`);
      process.exit(1);
    }
    
    // 먼저 개념 모델 로드
    console.log('개념 모델 로드 중...');
    const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
    const conceptModel = await conceptExtractor.extractAllModules();
    console.log(`개념 모델 로드 완료: ${conceptModel.modules.length}개 모듈 로드됨`);
    
    // 객체 추출기 초기화
    console.log('\n객체 추출기 초기화 중...');
    const objectExtractor = new ObjectExtractor(XSD_BASE_PATH);
    objectExtractor.setConceptualModel(conceptModel);
    console.log('객체 추출기 초기화 완료');
    
    // 도시 객체 추출
    console.log('\n모든 도시 객체 추출 중...');
    const cityObjects = objectExtractor.extractAllCityObjects();
    console.log(`도시 객체 추출 완료: ${cityObjects.size}개 객체 추출됨`);
    
    // 객체 모듈별 분류
    console.log('\n객체 모듈별 분류 중...');
    const objectsByModule = objectExtractor.classifyObjectsByModule();
    console.log('객체 모듈별 분류 완료');
    
    // 모듈별 객체 수 출력
    console.log('\n모듈별 객체 수:');
    Object.entries(objectsByModule).forEach(([moduleName, objects]) => {
      console.log(`- ${moduleName}: ${objects.length}개 객체`);
    });
    
    // LOD 정보 추출
    console.log('\nLOD 정보 추출 중...');
    const lodInfo = objectExtractor.extractLodInformation();
    console.log('LOD 정보 추출 완료');
    
    // 주요 객체의 LOD 범위 출력
    console.log('\n주요 객체의 LOD 범위:');
    const mainObjects = Array.from(cityObjects.entries()).slice(0, 5);
    mainObjects.forEach(([name, obj]) => {
      const lod = obj.lodInfo || { minLod: '없음', maxLod: '없음' };
      console.log(`- ${name}: LOD ${lod.minLod || 0} ~ ${lod.maxLod || 0}`);
    });
    
    // 기하학적 표현 추출
    console.log('\n기하학적 표현 추출 중...');
    const geometryReps = objectExtractor.extractGeometricRepresentations();
    console.log(`기하학적 표현 추출 완료: ${geometryReps.length}개 표현 유형 추출됨`);
    
    // 기하학적 표현 유형 요약
    console.log('\n기하학적 표현 유형:');
    geometryReps.slice(0, 10).forEach(geo => {
      console.log(`- ${geo.objectType}: ${geo.geometryType} (LOD ${geo.lod || '미지정'})`);
    });
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
    process.exit(1);
  }
  
  console.log('======== 객체 추출기 테스트 완료 ========');
}

// 테스트 실행
testObjectExtractor().then(() => {
  console.log('객체 추출기 테스트 성공적으로 완료됨');
}); 