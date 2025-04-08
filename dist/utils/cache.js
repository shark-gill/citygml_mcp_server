/**
 * 캐시 관리를 위한 유틸리티 함수
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// ESM에서 현재 디렉토리 가져오기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 캐시 디렉토리 경로
const CACHE_DIR = path.join(__dirname, '..', '..', '.cache');
// 기본 캐시 만료 시간 (1일)
const DEFAULT_TTL = 24 * 60 * 60 * 1000;
// 메모리 캐시
const memoryCache = {};
/**
 * 캐시 디렉토리 초기화
 */
export function initCache() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}
/**
 * 데이터를 메모리 캐시에 저장
 * @param key 캐시 키
 * @param data 저장할 데이터
 * @param ttl 만료 시간 (밀리초)
 */
export function setMemoryCache(key, data, ttl = DEFAULT_TTL) {
    memoryCache[key] = {
        data,
        expires: Date.now() + ttl
    };
}
/**
 * 메모리 캐시에서 데이터 가져오기
 * @param key 캐시 키
 * @returns 캐시된 데이터 또는 undefined
 */
export function getMemoryCache(key) {
    const cached = memoryCache[key];
    if (!cached) {
        return undefined;
    }
    // 만료 확인
    if (cached.expires < Date.now()) {
        delete memoryCache[key];
        return undefined;
    }
    return cached.data;
}
/**
 * 메모리 캐시 항목 삭제
 * @param key 캐시 키
 */
export function deleteMemoryCache(key) {
    delete memoryCache[key];
}
/**
 * 데이터를 디스크 캐시에 저장
 * @param key 캐시 키
 * @param data 저장할 데이터
 * @param ttl 만료 시간 (밀리초)
 */
export function setDiskCache(key, data, ttl = DEFAULT_TTL) {
    initCache();
    const cacheFile = path.join(CACHE_DIR, sanitizeFilename(key));
    const cacheData = {
        data,
        expires: Date.now() + ttl
    };
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData), 'utf8');
}
/**
 * 디스크 캐시에서 데이터 가져오기
 * @param key 캐시 키
 * @returns 캐시된 데이터 또는 undefined
 */
export function getDiskCache(key) {
    const cacheFile = path.join(CACHE_DIR, sanitizeFilename(key));
    if (!fs.existsSync(cacheFile)) {
        return undefined;
    }
    try {
        const cacheContent = fs.readFileSync(cacheFile, 'utf8');
        const cacheData = JSON.parse(cacheContent);
        // 만료 확인
        if (cacheData.expires < Date.now()) {
            fs.unlinkSync(cacheFile);
            return undefined;
        }
        return cacheData.data;
    }
    catch (error) {
        console.error(`캐시 파일 읽기 오류: ${key}`, error);
        return undefined;
    }
}
/**
 * 디스크 캐시 항목 삭제
 * @param key 캐시 키
 */
export function deleteDiskCache(key) {
    const cacheFile = path.join(CACHE_DIR, sanitizeFilename(key));
    if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
    }
}
/**
 * 모든 만료된 캐시 항목 정리
 */
export function cleanupExpiredCache() {
    // 메모리 캐시 정리
    const now = Date.now();
    Object.keys(memoryCache).forEach(key => {
        if (memoryCache[key].expires < now) {
            delete memoryCache[key];
        }
    });
    // 디스크 캐시 정리
    if (!fs.existsSync(CACHE_DIR)) {
        return;
    }
    fs.readdirSync(CACHE_DIR).forEach(file => {
        const cacheFile = path.join(CACHE_DIR, file);
        try {
            const cacheContent = fs.readFileSync(cacheFile, 'utf8');
            const cacheData = JSON.parse(cacheContent);
            if (cacheData.expires < now) {
                fs.unlinkSync(cacheFile);
            }
        }
        catch (error) {
            // 파일 읽기 실패 또는 잘못된 형식의 파일은 삭제
            fs.unlinkSync(cacheFile);
        }
    });
}
/**
 * 모든 캐시 초기화
 */
export function clearAllCache() {
    // 메모리 캐시 초기화
    Object.keys(memoryCache).forEach(key => {
        delete memoryCache[key];
    });
    // 디스크 캐시 초기화
    if (!fs.existsSync(CACHE_DIR)) {
        return;
    }
    fs.readdirSync(CACHE_DIR).forEach(file => {
        const cacheFile = path.join(CACHE_DIR, file);
        fs.unlinkSync(cacheFile);
    });
}
/**
 * 파일 이름으로 사용할 수 있도록 문자열 정리
 * @param input 원본 문자열
 * @returns 정리된 파일 이름
 */
function sanitizeFilename(input) {
    // URL 인코딩 및 특수 문자 제거
    return encodeURIComponent(input)
        .replace(/[%\/\?:]/g, '_')
        .substring(0, 255); // 파일 이름 길이 제한
}
