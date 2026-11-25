import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProjectAccessService } from '../src/common/access/project-access.service';
import { TasksModule } from '../src/modules/tasks/tasks.module';
import { HandoversModule } from '../src/modules/handovers/handovers.module';
import { BlockersModule } from '../src/modules/blockers/blockers.module';
import { TasksService } from '../src/modules/tasks/tasks.service';
import { HandoversService } from '../src/modules/handovers/handovers.service';
import { BlockersService } from '../src/modules/blockers/blockers.service';

/** Stands in for MongooseModule.forRoot so the real feature modules can be built without a database. */
@Global()
@Module({
  providers: [{ provide: getConnectionToken(), useValue: { models: {}, model: () => ({}) } }],
  exports: [getConnectionToken()],
})
class StubDatabaseModule {}

/**
 * The unit tests mock ProjectAccessService, so a missing module import would only
 * show up when the real app boots. This compiles the real modules to prove the
 * dependency is wired in all three.
 */
describe('ProjectAccessService wiring', () => {
  it('is provided to the tasks, handovers and blockers modules', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StubDatabaseModule, EventEmitterModule.forRoot(), TasksModule, HandoversModule, BlockersModule],
    }).compile();

    expect(moduleRef.get(TasksService, { strict: false })).toBeInstanceOf(TasksService);
    expect(moduleRef.get(HandoversService, { strict: false })).toBeInstanceOf(HandoversService);
    expect(moduleRef.get(BlockersService, { strict: false })).toBeInstanceOf(BlockersService);
    expect(moduleRef.get(ProjectAccessService, { strict: false })).toBeInstanceOf(ProjectAccessService);
  });
});
