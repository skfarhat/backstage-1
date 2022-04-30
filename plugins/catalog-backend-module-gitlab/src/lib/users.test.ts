/*
 * Copyright 2021 The Backstage Authors
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
import { ConfigReader } from '@backstage/config';
import { setupRequestMockHandlers } from '@backstage/test-utils';
import { readGitLabIntegrationConfig } from '@backstage/integration';
import { getVoidLogger } from '@backstage/backend-common';
import { rest } from 'msw';
import { setupServer, SetupServerApi } from 'msw/node';
import { GitLabClient } from './client';

import { getGroupMembers, getInstanceUsers } from './users';

const server = setupServer();
setupRequestMockHandlers(server);

const MOCK_CONFIG = readGitLabIntegrationConfig(
  new ConfigReader({
    host: 'example.com',
    token: 'test-token',
    apiBaseUrl: 'https://example.com/api/v4',
  }),
);

function setupFakeGroupMembers(
  srv: SetupServerApi,
  group: string,
  all?: boolean,
) {
  const allSuffix = all ? '/all' : '';
  const endpoint = `/groups/${encodeURIComponent(group)}/members${allSuffix}`;
  const url = `${MOCK_CONFIG.apiBaseUrl}${endpoint}`;

  srv.use(
    rest.get(url, (req, res, ctx) => {
      const blocked = req.url.searchParams.get('blocked');
      return res(
        ctx.set('x-next-page', ''),
        ctx.json([
          {
            id: 1,
            name: 'User One',
            username: 'user.one',
            state: 'active',
            avatar_url: 'https://example.com/avatar/1',
            web_url: 'https://example.com/user.one',
            access_level: 40,
            created_at: '2021-12-01T10:00:00.000Z',
            expires_at: null,
          },
          // spread array with inherited user if all is truthy
          ...(all
            ? [
                {
                  id: 2,
                  name: 'Inherited User',
                  username: 'inherited.user.two',
                  state: 'active',
                  avatar_url: 'https://example.com/avatar/2',
                  web_url: 'https://example.com/inherited.user.two',
                  access_level: 50,
                  created_at: '2021-12-02T11:00:00.000Z',
                  expires_at: null,
                },
              ]
            : []),
          // spread array if blocked query string is true
          ...(blocked === 'true'
            ? [
                {
                  id: 3,
                  name: 'Blocked User',
                  username: 'blocked.user.three',
                  state: 'blocked',
                  avatar_url: 'https://example.com/avatar/3',
                  web_url: 'https://example.com/blocked.user.three',
                  access_level: 40,
                  created_at: '2021-12-01T12:00:00.000Z',
                  expires_at: null,
                },
              ]
            : []),
        ]),
      );
    }),
  );
}

function setupFakeInstanceUsers(srv: SetupServerApi) {
  srv.use(
    rest.get(`${MOCK_CONFIG.apiBaseUrl}/users`, (_, res, ctx) => {
      return res(
        ctx.set('x-next-page', ''),
        ctx.json([
          // only primary email
          {
            id: 1,
            name: 'User One',
            username: 'user.one',
            state: 'active',
            avatar_url: 'https://example.com/avatar/1',
            web_url: 'https://example.com/user.one',
            created_at: '2021-12-01T10:00:00.000Z',
            bot: false,
            public_email: null,
            job_title: '',
            email: 'user.one@example.com',
          },
          // only public email
          {
            id: 2,
            name: 'User Two',
            username: 'user.two',
            state: 'active',
            avatar_url: 'https://example.com/avatar/2',
            web_url: 'https://example.com/user.two',
            created_at: '2021-12-01T10:00:00.000Z',
            bot: false,
            public_email: 'user.two.public@example.com',
            job_title: '',
          },
          // both public and primary email
          {
            id: 3,
            name: 'User Three',
            username: 'user.three',
            state: 'active',
            avatar_url: 'https://example.com/avatar/3',
            web_url: 'https://example.com/user.three',
            created_at: '2021-12-01T10:00:00.000Z',
            bot: false,
            public_email: 'user.three.public@example.com',
            email: 'user.three.primary@example.com',
            job_title: '',
          },
          // bot user
          {
            id: 4,
            name: 'Project Bot User',
            username: 'project_4_bot',
            state: 'active',
            avatar_url: 'https://example.com/avatar/4',
            web_url: 'https://example.com/project_4_bot',
            created_at: '2021-12-01T10:00:00.000Z',
            bot: true,
            public_email: 'project4_bot@example.com',
            job_title: '',
          },
        ]),
      );
    }),
  );
}

describe('getGroupMembers', () => {
  const TEST_GROUP = 'parent/child';

  it('should return an array of direct users', async () => {
    setupFakeGroupMembers(server, TEST_GROUP);
    const client = new GitLabClient({
      config: MOCK_CONFIG,
      logger: getVoidLogger(),
    });

    const users = await getGroupMembers(client, TEST_GROUP);
    expect(users).toHaveLength(1);
    expect(users[0]).toHaveProperty('kind', 'User');
    expect(users[0]).toHaveProperty('metadata.name', 'user.one');
    expect(users[0]).toHaveProperty('spec.profile.displayName', 'User One');
    expect(users[0]).toHaveProperty(
      'spec.profile.picture',
      'https://example.com/avatar/1',
    );
  });

  it('should return an array of all users including inherited', async () => {
    setupFakeGroupMembers(server, TEST_GROUP, true);
    const client = new GitLabClient({
      config: MOCK_CONFIG,
      logger: getVoidLogger(),
    });

    const users = await getGroupMembers(client, TEST_GROUP, true);
    expect(users).toHaveLength(2);
    expect(users[1]).toHaveProperty('metadata.name', 'inherited.user.two');
  });

  it('should include blocked members if requested', async () => {
    setupFakeGroupMembers(server, TEST_GROUP, true);
    const client = new GitLabClient({
      config: MOCK_CONFIG,
      logger: getVoidLogger(),
    });

    const users = await getGroupMembers(client, TEST_GROUP, true, true);
    expect(users).toHaveLength(3);
    expect(users[2]).toHaveProperty('metadata.name', 'blocked.user.three');
  });
});

describe('getInstanceUsers', () => {
  beforeEach(() => {
    setupFakeInstanceUsers(server);
  });

  it('should return an array of actual users', async () => {
    const client = new GitLabClient({
      config: MOCK_CONFIG,
      logger: getVoidLogger(),
    });

    const users = await getInstanceUsers(client);
    // should exclude bot user
    expect(users).toHaveLength(3);
  });

  it('should map response to user entities', async () => {
    const client = new GitLabClient({
      config: MOCK_CONFIG,
      logger: getVoidLogger(),
    });

    const users = await getInstanceUsers(client);
    expect(users[0]).toHaveProperty('kind', 'User');
    expect(users[0]).toHaveProperty('metadata.name', 'user.one');
    expect(users[0]).toHaveProperty('spec.profile.displayName', 'User One');
    expect(users[0]).toHaveProperty(
      'spec.profile.email',
      'user.one@example.com',
    );
    expect(users[0]).toHaveProperty(
      'spec.profile.picture',
      'https://example.com/avatar/1',
    );
  });

  it('should use appropriate email', async () => {
    const client = new GitLabClient({
      config: MOCK_CONFIG,
      logger: getVoidLogger(),
    });
    const users = await getInstanceUsers(client);

    // should use public email if primary unavailable
    expect(users[1]).toHaveProperty(
      'spec.profile.email',
      'user.two.public@example.com',
    );
    // should use primary email over public email
    expect(users[2]).toHaveProperty(
      'spec.profile.email',
      'user.three.primary@example.com',
    );
  });
});
