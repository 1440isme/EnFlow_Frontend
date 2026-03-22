'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Task, Status, Priority } from '@/types/task';
import { Badge } from '../ui/badge';
import { Calendar } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const priorityColors: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const priorityLabels: Record<Priority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  urgent: 'Khẩn cấp',
};

interface TaskCardProps {
  task: Task;
  onTaskClick: (taskId: string) => void;
}

function TaskCard({ task, onTaskClick }: TaskCardProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TASK',
    item: { id: task.id, currentStatus: task.status },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={(node) => {
        drag(node);
      }}
      onClick={() => onTaskClick(task.id)}
      className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="space-y-3">
        <div>
          <h4 className="font-medium text-gray-900 mb-1">{task.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={priorityColors[task.priority]}>
            {priorityLabels[task.priority]}
          </Badge>
          {task.tags.slice(0, 2).map((tag, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <img
              src={task.assigneeAvatar}
              alt={task.assignee}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-xs">{task.assignee.split(' ')[0]}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Calendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString('vi-VN', {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ColumnProps {
  status: Status;
  title: string;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onDrop: (taskId: string, newStatus: Status) => void;
}

function Column({ status, title, tasks, onTaskClick, onDrop }: ColumnProps) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'TASK',
    drop: (item: { id: string; currentStatus: Status }) => {
      if (item.currentStatus !== status) {
        onDrop(item.id, status);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const colorMap = {
    todo: 'border-gray-300 bg-gray-50',
    'in-progress': 'border-orange-300 bg-orange-50',
    done: 'border-green-300 bg-green-50',
  };

  return (
    <div className="flex-1 min-w-[300px]">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {tasks.length}
          </span>
        </div>
      </div>
      <div
        ref={(node) => {
          drop(node);
        }}
        className={`space-y-3 min-h-[500px] p-3 rounded-lg border-2 border-dashed transition-colors ${
          isOver ? 'border-[#004ba8] bg-blue-50' : colorMap[status]
        }`}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onTaskClick={onTaskClick} />
        ))}
      </div>
    </div>
  );
}

export default function KanbanBoardTab() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);

  const handleTaskClick = (taskId: string) => {
    router.push(`/app/tasks/${taskId}`);
  };

  const handleDrop = (taskId: string, newStatus: Status) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );
  };

  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex gap-6 overflow-x-auto pb-4">
        <Column
          status="todo"
          title="📋 To Do"
          tasks={todoTasks}
          onTaskClick={handleTaskClick}
          onDrop={handleDrop}
        />
        <Column
          status="in-progress"
          title="🚀 In Progress"
          tasks={inProgressTasks}
          onTaskClick={handleTaskClick}
          onDrop={handleDrop}
        />
        <Column
          status="done"
          title="✅ Done"
          tasks={doneTasks}
          onTaskClick={handleTaskClick}
          onDrop={handleDrop}
        />
      </div>
    </DndProvider>
  );
}
