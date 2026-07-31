/*
 * @testing-library/jest-dom のマッチャー型を vitest の expect に取り込む。
 * 実体(マッチャー登録)は vitest-setup-client.ts が行う。ルート直下の setup
 * ファイルは tsconfig の include 外のため、型だけここで src に取り込んでいる。
 */
import '@testing-library/jest-dom/vitest';
