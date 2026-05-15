export interface DocumentService {
    save: (doc: string) => Promise<string>;
}