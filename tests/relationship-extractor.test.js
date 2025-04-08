import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { ConceptExtractor } from '../dist/extractors/concepts.js';
import { ObjectExtractor } from '../dist/extractors/objects.js';
import { RelationshipExtractor } from '../dist/extractors/relationships.js';

// ES 모듈에서 __dirname을 사용하기 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// XSD 파일 경로
const XSD_BASE_PATH = path.join(__dirname, '..', 'xsds');

/**
 * 관계 추출기 기본 테스트
 */
async function testRelationshipExtractor() {
  console.log('======== 관계 추출기 테스트 시작 ========');
  
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
    
    // 관계 추출기 초기화
    console.log('\n관계 추출기 초기화 중...');
    const relationshipExtractor = new RelationshipExtractor(XSD_BASE_PATH);
    relationshipExtractor.setConceptualModel(conceptModel);
    relationshipExtractor.setCityObjects(cityObjects);
    console.log('관계 추출기 초기화 완료');
    
    // 모든 공간 관계 추출
    console.log('\n공간 관계 추출 중...');
    const spatialRelationships = relationshipExtractor.extractSpatialRelationships();
    console.log(`공간 관계 추출 완료: ${spatialRelationships.length}개 공간 관계 추출됨`);
    
    // 일부 공간 관계 출력
    if (spatialRelationships.length > 0) {
      console.log('\n주요 공간 관계 예시:');
      spatialRelationships.slice(0, 5).forEach(relation => {
        console.log(`- ${relation.sourceObject} ${relation.type} ${relation.targetObject}`);
      });
    }
    
    // 의미적 관계 추출
    console.log('\n의미적 관계 추출 중...');
    const semanticRelationships = relationshipExtractor.extractSemanticRelationships();
    console.log(`의미적 관계 추출 완료: ${semanticRelationships.length}개 의미적 관계 추출됨`);
    
    // 일부 의미적 관계 출력
    if (semanticRelationships.length > 0) {
      console.log('\n주요 의미적 관계 예시:');
      semanticRelationships.slice(0, 5).forEach(relation => {
        console.log(`- ${relation.sourceObject} ${relation.type} ${relation.targetObject}`);
      });
    }
    
    // 연관 관계 추출
    console.log('\n연관 관계 추출 중...');
    const associations = relationshipExtractor.extractAssociations();
    console.log(`연관 관계 추출 완료: ${associations.length}개 연관 관계 추출됨`);
    
    // 객체별 관계 분류
    console.log('\n객체별 관계 분류 중...');
    const relationshipsByObject = relationshipExtractor.classifyRelationshipsByObject();
    console.log('객체별 관계 분류 완료');
    
    // 주요 객체의 관계 수 출력
    console.log('\n주요 객체의 관계 수:');
    const mainObjects = Object.keys(relationshipsByObject).slice(0, 5);
    mainObjects.forEach(objectName => {
      const relations = relationshipsByObject[objectName] || [];
      console.log(`- ${objectName}: ${relations.length}개 관계`);
    });
    
    // 집합 및 합성 관계 추출
    console.log('\n집합 및 합성 관계 추출 중...');
    const aggregationsAndCompositions = relationshipExtractor.extractAggregationsAndCompositions();
    console.log(`집합 및 합성 관계 추출 완료:`);
    console.log(`- 집합 관계: ${aggregationsAndCompositions.aggregations.length}개`);
    console.log(`- 합성 관계: ${aggregationsAndCompositions.compositions.length}개`);
    
    // 참조 무결성 규칙 추출
    console.log('\n참조 무결성 규칙 추출 중...');
    const integrityRules = relationshipExtractor.extractReferentialIntegrityRules();
    console.log(`참조 무결성 규칙 추출 완료: ${integrityRules.length}개 규칙 추출됨`);
    
    // 관계의 방향성 및 다중성 처리
    console.log('\n관계의 방향성 및 다중성 분석 중...');
    const directionalityAndMultiplicity = relationshipExtractor.analyzeDirectionalityAndMultiplicity();
    console.log('관계의 방향성 및 다중성 분석 완료');
    
    // 다중성 유형 분포 출력
    console.log('\n다중성 유형 분포:');
    Object.entries(directionalityAndMultiplicity.multiplicityTypes).forEach(([type, count]) => {
      console.log(`- ${type}: ${count}개 관계`);
    });
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
    process.exit(1);
  }
  
  console.log('======== 관계 추출기 테스트 완료 ========');
}

// 테스트 실행
testRelationshipExtractor().then(() => {
  console.log('관계 추출기 테스트 성공적으로 완료됨');
}); 