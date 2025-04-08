import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { ConceptExtractor } from '../dist/extractors/concepts.js';
import { ObjectExtractor } from '../dist/extractors/objects.js';
import { AttributeExtractor } from '../dist/extractors/attributes.js';

// ES 모듈에서 __dirname을 사용하기 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// XSD 파일 경로
const XSD_BASE_PATH = path.join(__dirname, '..', 'xsds');

/**
 * 속성 추출기 기본 테스트
 */
async function testAttributeExtractor() {
  console.log('======== 속성 추출기 테스트 시작 ========');
  
  try {
    // XSD 디렉토리 확인
    if (!fs.existsSync(XSD_BASE_PATH)) {
      console.error(`오류: XSD 디렉토리가 존재하지 않습니다. 경로: ${XSD_BASE_PATH}`);
      process.exit(1);
    }
    
    // 먼저 개념 모델과 객체 모델 로드
    console.log('개념 모델 로드 중...');
    const conceptExtractor = new ConceptExtractor(XSD_BASE_PATH);
    const conceptModel = await conceptExtractor.extractAllModules();
    console.log(`개념 모델 로드 완료: ${conceptModel.modules.length}개 모듈 로드됨`);
    
    console.log('\n객체 모델 로드 중...');
    const objectExtractor = new ObjectExtractor(XSD_BASE_PATH);
    objectExtractor.setConceptualModel(conceptModel);
    const cityObjects = objectExtractor.extractAllCityObjects();
    console.log(`객체 모델 로드 완료: ${cityObjects.size}개 객체 로드됨`);
    
    // 속성 추출기 초기화
    console.log('\n속성 추출기 초기화 중...');
    const attributeExtractor = new AttributeExtractor(XSD_BASE_PATH);
    attributeExtractor.setConceptualModel(conceptModel);
    attributeExtractor.setCityObjects(cityObjects);
    console.log('속성 추출기 초기화 완료');
    
    // 모든 속성 추출
    console.log('\n모든 객체 속성 추출 중...');
    const allAttributes = attributeExtractor.extractAllAttributes();
    console.log(`속성 추출 완료: ${allAttributes.size}개 속성 추출됨`);
    
    // 객체별 속성 분석
    console.log('\n객체별 속성 분석 중...');
    const attributesByObject = attributeExtractor.classifyAttributesByObject();
    console.log('객체별 속성 분석 완료');
    
    // 주요 객체의 속성 수 출력
    console.log('\n주요 객체의 속성 수:');
    const mainObjects = Object.keys(attributesByObject).slice(0, 5);
    mainObjects.forEach(objectName => {
      const attributes = attributesByObject[objectName] || [];
      console.log(`- ${objectName}: ${attributes.length}개 속성`);
    });
    
    // 속성 타입 분석
    console.log('\n속성 타입 분석 중...');
    const attributeTypes = attributeExtractor.analyzeAttributeTypes();
    console.log('속성 타입 분석 완료');
    
    // 속성 타입 분포 출력
    console.log('\n속성 타입 분포:');
    Object.entries(attributeTypes).forEach(([type, count]) => {
      console.log(`- ${type}: ${count}개 속성`);
    });
    
    // 코드 리스트 및 열거형 추출
    console.log('\n코드 리스트 및 열거형 추출 중...');
    const codelistsAndEnums = attributeExtractor.extractCodeListsAndEnumerations();
    console.log(`코드 리스트 및 열거형 추출 완료: ${codelistsAndEnums.codelists.length}개 코드 리스트, ${codelistsAndEnums.enumerations.length}개 열거형`);
    
    // 코드 리스트 샘플 출력
    if (codelistsAndEnums.codelists.length > 0) {
      console.log('\n코드 리스트 샘플:');
      codelistsAndEnums.codelists.slice(0, 3).forEach(codelist => {
        console.log(`- ${codelist.name}: ${codelist.values.length}개 값`);
        if (codelist.values.length > 0) {
          console.log(`  예시 값: ${codelist.values.slice(0, 3).join(', ')}...`);
        }
      });
    }
    
    // 카디널리티 및 제약조건 분석
    console.log('\n카디널리티 및 제약조건 분석 중...');
    const constraints = attributeExtractor.analyzeCardinalityAndConstraints();
    console.log('카디널리티 및 제약조건 분석 완료');
    
    // 메타데이터 속성 관리
    console.log('\n메타데이터 속성 추출 중...');
    const metadataAttrs = attributeExtractor.extractMetadataAttributes();
    console.log(`메타데이터 속성 추출 완료: ${metadataAttrs.length}개 메타데이터 속성 식별됨`);
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
    process.exit(1);
  }
  
  console.log('======== 속성 추출기 테스트 완료 ========');
}

// 테스트 실행
testAttributeExtractor().then(() => {
  console.log('속성 추출기 테스트 성공적으로 완료됨');
}); 