import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Ingestion() {
  const [arxivId, setArxivId] = useState('');
  const [bulkIds, setBulkIds] = useState('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const ingestMutation = useMutation({
    mutationFn: (id: string) => api.ingest.arxiv(id),
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      setArxivId('');
    },
  });

  const { data: jobStatus } = useQuery({
    queryKey: ['job-status', currentJobId],
    queryFn: () => api.ingest.status(currentJobId!),
    enabled: !!currentJobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'processing' || data?.status === 'queued') {
        return 2000;
      }
      return false;
    },
  });

  const handleSingleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (arxivId.trim()) {
      ingestMutation.mutate(arxivId.trim());
    }
  };

  const handleBulkIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const ids = bulkIds
      .split(/[\n,]/)
      .map((id) => id.trim())
      .filter(Boolean);

    for (const id of ids) {
      await ingestMutation.mutateAsync(id);
    }
    setBulkIds('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add Papers</h1>
        <p className="text-sm text-gray-600 mt-1">
          Import research papers from arXiv to build your knowledge graph
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Single Paper</h2>
              <p className="text-xs text-gray-500">Add one paper at a time</p>
            </div>
          </div>

          <form onSubmit={handleSingleIngest} className="space-y-4">
            <div>
              <label htmlFor="arxiv-id" className="block text-sm font-medium text-gray-700 mb-2">
                arXiv ID
              </label>
              <input
                type="text"
                id="arxiv-id"
                value={arxivId}
                onChange={(e) => setArxivId(e.target.value)}
                placeholder="e.g., 2308.04079"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Enter the arXiv ID without the 'arXiv:' prefix
              </p>
            </div>

            <button
              type="submit"
              disabled={ingestMutation.isPending || !arxivId.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {ingestMutation.isPending ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                </span>
              ) : (
                'Add Paper'
              )}
            </button>

            {ingestMutation.isError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium">
                  {(ingestMutation.error as Error).message}
                </p>
              </div>
            )}
          </form>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bulk Import</h2>
              <p className="text-xs text-gray-500">Add multiple papers at once</p>
            </div>
          </div>

          <form onSubmit={handleBulkIngest} className="space-y-4">
            <div>
              <label htmlFor="bulk-ids" className="block text-sm font-medium text-gray-700 mb-2">
                arXiv IDs
              </label>
              <textarea
                id="bulk-ids"
                rows={5}
                value={bulkIds}
                onChange={(e) => setBulkIds(e.target.value)}
                placeholder="2308.04079&#10;2311.18840&#10;2312.01337"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm resize-none"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                One ID per line or comma-separated
              </p>
            </div>

            <button
              type="submit"
              disabled={ingestMutation.isPending || !bulkIds.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              {ingestMutation.isPending ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Import Papers'
              )}
            </button>
          </form>
        </div>
      </div>

      {currentJobId && jobStatus && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Processing Status</h2>
              <p className="text-xs text-gray-500">Track your import progress</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Job ID</span>
              <span className="text-sm font-mono text-gray-900">{currentJobId}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Status</span>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  jobStatus.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : jobStatus.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
              </span>
            </div>

            {jobStatus.paperId && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="text-sm font-medium text-green-700">Paper ID</span>
                <span className="text-sm font-mono text-green-900">{jobStatus.paperId}</span>
              </div>
            )}

            {jobStatus.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium">{jobStatus.error}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
