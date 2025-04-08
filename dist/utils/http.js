/**
 * HTTP 요청 처리를 위한 유틸리티 함수
 */
import axios from 'axios';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1초
/**
 * 특정 URL에서 문서를 가져오는 함수
 * @param url 문서를 가져올 URL
 * @param options Axios 요청 옵션
 * @returns 요청 결과
 */
export async function fetchDocument(url, options) {
    let retries = 0;
    while (true) {
        try {
            const response = await axios.get(url, {
                timeout: 10000, // 10초 타임아웃
                ...options
            });
            return response.data;
        }
        catch (error) {
            retries++;
            if (retries >= MAX_RETRIES) {
                console.error(`문서 가져오기 실패: ${url}`, error);
                throw new Error(`문서 가져오기 실패: ${url} - ${error instanceof Error ? error.message : String(error)}`);
            }
            console.warn(`재시도 중... (${retries}/${MAX_RETRIES}): ${url}`);
            await delay(RETRY_DELAY * retries);
        }
    }
}
/**
 * 여러 URL에서 병렬로 문서를 가져오는 함수
 * @param urls 문서를 가져올 URL 배열
 * @param options Axios 요청 옵션
 * @returns 요청 결과 배열
 */
export async function fetchMultipleDocuments(urls, options) {
    const promises = urls.map(url => fetchDocument(url, options));
    return Promise.all(promises);
}
/**
 * 지연 함수
 * @param ms 지연 시간 (밀리초)
 * @returns Promise
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * URL이 유효한지 확인하는 함수
 * @param url 확인할 URL
 * @returns 유효 여부
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * 상대 URL을 절대 URL로 변환하는 함수
 * @param baseUrl 기준 URL
 * @param relativeUrl 상대 URL
 * @returns 절대 URL
 */
export function resolveUrl(baseUrl, relativeUrl) {
    return new URL(relativeUrl, baseUrl).href;
}
