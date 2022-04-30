/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getVoidLogger } from '@backstage/backend-common';
import { GitLabOrgEntityProvider } from './GitLabOrgEntityProvider';
import { readGroups, readUsers } from './lib';

describe('GitLabOrgEntityProvider', () => {
  const logger = getVoidLogger();

  describe('getProviderName', () => {
    it('should provide its suffixed name', () => {
      const processor = new (GitLabOrgEntityProvider as any)({
        id: 'test',
        targets: [],
        clientFactory: () => null as any,
        logger,
      });
      expect(processor.getProviderName()).toEqual(
        'GitLabOrgEntityProvider:test',
      );
    });
  });

  describe('read', () => {
    it('missing connection should error', async () => {
      const provider = new (GitLabOrgEntityProvider as any)({
        id: 'test',
        targets: [],
        clientFactory: () => null as any,
        logger,
      });
      await expect(provider.read()).rejects.toThrowError();
    });

    it('should handle targets with user ingestion enabled', async () => {
      const provider = new (GitLabOrgEntityProvider as any)({
        id: 'test',
        targets: [],
        clientFactory: () => null as any,
        logger,
      });
      await provider.connect({
        applyMutation: jest.fn(),
      });

      await provider.read();
      expect(readUsers).toBeCalled();
    });

    it('should handle targets with group ingestion enabled', async () => {
      const provider = new (GitLabOrgEntityProvider as any)({
        id: 'test',
        targets: [],
        clientFactory: () => null as any,
        logger,
      });
      const mockApplyMutation = jest.fn();
      await provider.connect({
        applyMutation: mockApplyMutation,
      });

      await provider.read();
      expect(readGroups).toBeCalled();
    });
  });
});
